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
    const planTier = url.searchParams.get('plan_tier') || 'standard';
    const partnerId = url.searchParams.get('partner_id');

    if (!portalId) {
      throw new Error('portal_id is required');
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if customer already exists
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

      // Create customer record
      const { error: customerError } = await supabase
        .from('customers')
        .insert({
          platform: 'hubspot',
          platform_customer_id: portalId,
          stripe_customer_id: stripeCustomer.id,
          metadata: {
            portal_id: portalId
          }
        });

      if (customerError) {
        throw new Error(`Failed to create customer record: ${customerError.message}`);
      }

      stripeCustomerId = stripeCustomer.id;
    }

    // Get price ID for the plan
    const priceId = await getPriceIdForPlan(planTier);

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      success_url: `${APP_URL}/settings/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/settings/billing/cancel`,
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      metadata: {
        portal_id: portalId,
        plan_tier: planTier,
        partner_id: partnerId || ''
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

// Helper function to get price ID based on plan tier
async function getPriceIdForPlan(planTier: string): Promise<string> {
  const priceIds: { [key: string]: string } = {
    standard: Deno.env.get('STRIPE_STANDARD_PRICE_ID')!,
    premium: Deno.env.get('STRIPE_PREMIUM_PRICE_ID')!,
    enterprise: Deno.env.get('STRIPE_ENTERPRISE_PRICE_ID')!
  };

  const priceId = priceIds[planTier];
  if (!priceId) {
    throw new Error(`Invalid plan tier: ${planTier}`);
  }

  return priceId;
} 