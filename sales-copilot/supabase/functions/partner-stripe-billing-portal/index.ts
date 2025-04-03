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

    // Parse URL and get portal_id
    const url = new URL(req.url);
    const portalId = url.searchParams.get('portal_id');

    if (!portalId) {
      throw new Error('portal_id is required');
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get customer details from database
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('stripe_customer_id')
      .eq('platform', 'hubspot')
      .eq('platform_customer_id', portalId)
      .single();

    if (customerError || !customer) {
      throw new Error('Customer not found');
    }

    if (!customer.stripe_customer_id) {
      throw new Error('Customer has no associated Stripe account');
    }

    // Create configuration for the billing portal
    const configuration = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: 'Sales Copilot Subscription Management',
      },
      features: {
        subscription_cancel: {
          enabled: true,
          mode: 'at_period_end',
          proration_behavior: 'none',
        },
        subscription_pause: {
          enabled: false,
        },
        payment_method_update: {
          enabled: true,
        },
        invoice_history: {
          enabled: true,
        },
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price'],
          proration_behavior: 'always_invoice',
          products: await getAvailableProductIds(),
        },
      },
    });

    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: `${APP_URL}/settings/billing?portal_id=${portalId}`,
      configuration: configuration.id,
    });

    // Return the portal URL
    return new Response(
      JSON.stringify({
        url: session.url,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

// Helper function to get available product IDs for plan changes
async function getAvailableProductIds(): Promise<string[]> {
  const products = await stripe.products.list({
    active: true,
    expand: ['data.default_price'],
  });

  return products.data
    .filter(product => product.active)
    .map(product => product.id);
} 