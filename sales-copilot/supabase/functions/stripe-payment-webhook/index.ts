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
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

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

    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      throw new Error('No Stripe signature found');
    }

    // Verify the webhook signature
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET
    );

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Log the event
    await supabase.from('stripe_events').insert({
      event_type: event.type,
      stripe_event_id: event.id,
      api_version: event.api_version,
      raw_payload: event.data.object,
    });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;
        const metadata = session.metadata;

        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        // Update customer subscription status
        await supabase
          .from('subscriptions')
          .insert({
            customer_id: (await getCustomerIdFromStripeId(supabase, customerId))!,
            partner_id: metadata.partner_id || null,
            stripe_subscription_id: subscriptionId,
            status: subscription.status,
            plan_tier: metadata.plan_tier,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            metadata: {
              portal_id: metadata.portal_id
            }
          });

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        
        await supabase
          .from('subscriptions')
          .update({
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', subscription.id);

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        
        await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            canceled_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', subscription.id);

        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          // If this is a subscription invoice, update the subscription record
          await supabase
            .from('subscriptions')
            .update({
              current_period_end: new Date(invoice.period_end * 1000).toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('stripe_subscription_id', invoice.subscription);

          // If there's a partner associated, create a pending payout record
          const subscription = await getSubscriptionWithPartner(supabase, invoice.subscription);
          if (subscription?.partner_id) {
            const commissionAmount = calculateCommission(invoice.amount_paid);
            await createPartnerPayout(supabase, {
              partnerId: subscription.partner_id,
              amount: commissionAmount,
              invoiceId: invoice.id,
              subscriptionId: invoice.subscription
            });
          }
        }
        break;
      }
    }

    // Return a success response
    return new Response(
      JSON.stringify({ received: true }),
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

// Helper function to get customer ID from Stripe customer ID
async function getCustomerIdFromStripeId(supabase: any, stripeCustomerId: string): Promise<string | null> {
  const { data } = await supabase
    .from('customers')
    .select('id')
    .eq('stripe_customer_id', stripeCustomerId)
    .single();
  
  return data?.id || null;
}

// Helper function to get subscription with partner details
async function getSubscriptionWithPartner(supabase: any, stripeSubscriptionId: string) {
  const { data } = await supabase
    .from('subscriptions')
    .select('*, partner:partners(id, commission_rate)')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .single();
  
  return data;
}

// Helper function to calculate partner commission
function calculateCommission(amount: number): number {
  const commissionRate = 0.20; // 20% commission
  return Math.floor(amount * commissionRate);
}

// Helper function to create partner payout record
async function createPartnerPayout(supabase: any, data: {
  partnerId: string;
  amount: number;
  invoiceId: string;
  subscriptionId: string;
}) {
  return await supabase
    .from('partner_payouts')
    .insert({
      partner_id: data.partnerId,
      amount: data.amount,
      status: 'pending',
      metadata: {
        stripe_invoice_id: data.invoiceId,
        stripe_subscription_id: data.subscriptionId
      }
    });
} 