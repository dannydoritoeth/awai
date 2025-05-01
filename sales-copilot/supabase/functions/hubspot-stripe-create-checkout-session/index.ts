import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import Stripe from 'https://esm.sh/stripe@14.12.0?target=deno';
import { corsHeaders } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = Deno.env.get('APP_URL')!;

// Valid plan tiers and intervals
const VALID_PLAN_TIERS = ['starter', 'pro', 'growth'] as const;
const VALID_INTERVALS = ['month', 'year'] as const;
type PlanTier = typeof VALID_PLAN_TIERS[number];
type Interval = typeof VALID_INTERVALS[number];

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Parse URL parameters
    const url = new URL(req.url);
    const portalId = url.searchParams.get('portal_id');
    const planTier = url.searchParams.get('plan_tier');
    const interval = url.searchParams.get('interval');
    const partnerId = url.searchParams.get('partner_id');

    // Validate required parameters
    if (!portalId) {
      return new Response(
        JSON.stringify({
          error: 'portal_id is required'
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    if (!planTier) {
      return new Response(
        JSON.stringify({
          error: 'plan_tier is required'
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    if (!interval) {
      return new Response(
        JSON.stringify({
          error: 'interval is required'
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Validate plan tier
    if (!VALID_PLAN_TIERS.includes(planTier as PlanTier)) {
      return new Response(
        JSON.stringify({
          error: `Invalid plan_tier. Must be one of: ${VALID_PLAN_TIERS.join(', ')}`
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Validate interval
    if (!VALID_INTERVALS.includes(interval as Interval)) {
      return new Response(
        JSON.stringify({
          error: `Invalid interval. Must be one of: ${VALID_INTERVALS.join(', ')}`
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify HubSpot account exists and is active
    const { data: hubspotAccount, error: accountError } = await supabase
      .from('hubspot_accounts')
      .select('portal_id, status')
      .eq('portal_id', portalId)
      .single();

    if (accountError || !hubspotAccount) {
      throw new Error('HubSpot account not found');
    }

    if (hubspotAccount.status !== 'active') {
      throw new Error('HubSpot account is not active');
    }

    // First try to get the existing customer
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, stripe_customer_id')
      .eq('platform', 'hubspot')
      .eq('platform_customer_id', portalId)
      .single();

    let stripeCustomerId: string;

    if (existingCustomer?.stripe_customer_id) {
      stripeCustomerId = existingCustomer.stripe_customer_id;
    } else {
      // Create new Stripe customer
      const stripeCustomer = await stripe.customers.create({
        metadata: {
          portal_id: portalId,
          platform: 'hubspot'
        }
      });

      // Use upsert to handle race conditions
      const { error: customerError } = await supabase
        .from('customers')
        .upsert({
          platform: 'hubspot',
          platform_customer_id: portalId,
          stripe_customer_id: stripeCustomer.id,
          metadata: {
            portal_id: portalId
          }
        }, {
          onConflict: 'platform,platform_customer_id',
          ignoreDuplicates: false
        });

      if (customerError) {
        // If upsert failed, try to get the customer one more time
        const { data: retryCustomer } = await supabase
          .from('customers')
          .select('stripe_customer_id')
          .eq('platform', 'hubspot')
          .eq('platform_customer_id', portalId)
          .single();

        if (retryCustomer?.stripe_customer_id) {
          stripeCustomerId = retryCustomer.stripe_customer_id;
        } else {
          throw new Error(`Failed to create or retrieve customer record: ${customerError.message}`);
        }
      } else {
        stripeCustomerId = stripeCustomer.id;
      }
    }

    // Get plan details from the plans table
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('tier', planTier)
      .eq('interval', interval)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      throw new Error(`Plan not found for tier ${planTier} and interval ${interval}`);
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      success_url: `${APP_URL}/settings/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/settings/billing/cancel`,
      line_items: [{
        price: plan.stripe_price_id,
        quantity: 1
      }],
      metadata: {
        portal_id: portalId,
        plan_tier: planTier,
        partner_id: partnerId || '',
        interval: interval
      },
      subscription_data: partnerId ? {
        metadata: {
          partner_id: partnerId,
          portal_id: portalId
        }
      } : undefined,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      payment_method_types: ['card'],
      customer_update: {
        address: 'auto'
      }
    });

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
}); 