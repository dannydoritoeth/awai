import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

// Types for Stripe events
interface StripeEvent {
  id: string;
  type: string;
  api_version: string;
  data: {
    object: any;
  };
}

// Helper function to verify Stripe webhook signature
async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  try {
    const TIMESTAMP_TOLERANCE = 300; // 5 minutes tolerance
    
    // Split the header into timestamp and signatures
    const parts = header.split(',').reduce((acc: { [key: string]: string }, part: string) => {
      const [key, value] = part.split('=');
      acc[key] = value;
      return acc;
    }, {});

    const timestamp = parts.t;
    const signatures = parts.v1;

    if (!timestamp || !signatures) {
      throw new Error('Invalid signature header format');
    }

    // Check timestamp freshness
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > TIMESTAMP_TOLERANCE) {
      throw new Error('Timestamp outside tolerance window');
    }

    // Prepare the signed payload
    const signedPayload = `${timestamp}.${payload}`;

    // Import the secret key
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Generate expected signature
    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(signedPayload)
    );

    // Convert to hex
    const expectedSignature = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Check if any of the provided signatures match
    return signatures.split(',').some(sig => sig === expectedSignature);

  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

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

    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      throw new Error('No signature found');
    }

    // Verify signature
    const isValid = await verifyStripeSignature(rawBody, signature, STRIPE_WEBHOOK_SECRET);
    if (!isValid) {
      throw new Error('Invalid signature');
    }

    // Parse event data
    const event = JSON.parse(rawBody) as StripeEvent;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Log raw event first for debugging
    await supabase.from('stripe_events').insert({
      event_type: event.type,
      stripe_event_id: event.id,
      api_version: event.api_version,
      raw_payload: event.data.object,
      processed: false
    });

    // Handle specific events
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { data: customer } = await supabase
          .from('customers')
          .select('id')
          .eq('stripe_customer_id', session.customer)
          .single();

        if (customer) {
          const now = new Date();
          const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          
          await supabase.from('subscriptions').insert({
            customer_id: customer.id,
            partner_id: session.metadata?.partner_id || null,
            stripe_subscription_id: session.subscription,
            status: 'active',
            plan_tier: session.metadata?.plan_tier,
            current_period_start: now.toISOString(),
            current_period_end: thirtyDaysFromNow.toISOString(),
            metadata: {
              portal_id: session.metadata?.portal_id
            }
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        console.log('Raw subscription object:', JSON.stringify(subscription, null, 2));

        // Get timestamps from subscription items (first item)
        const subscriptionItem = subscription.items?.data?.[0];
        console.log('First subscription item:', subscriptionItem);

        // Get payment details
        const plan = subscriptionItem?.plan || subscription.plan;
        const price = subscriptionItem?.price || plan;
        const amount = price?.amount;
        const currency = price?.currency;
        const interval = price?.recurring?.interval || plan?.interval;

        // Try to get timestamps from subscription item first, then fall back to other fields
        const startTimestamp = subscriptionItem?.current_period_start || 
                             subscription.start_date || 
                             subscription.billing_cycle_anchor;
        const endTimestamp = subscriptionItem?.current_period_end || 
                           (startTimestamp && Number(startTimestamp) + (30 * 24 * 60 * 60));

        if (!startTimestamp || !endTimestamp) {
          console.error('Missing timestamp data:', { 
            startTimestamp, 
            endTimestamp,
            itemStart: subscriptionItem?.current_period_start,
            itemEnd: subscriptionItem?.current_period_end,
            start_date: subscription.start_date,
            billing_cycle_anchor: subscription.billing_cycle_anchor
          });
          // Store the event for manual review instead of failing
          await supabase.from('failed_webhook_events').insert({
            event_type: event.type,
            stripe_event_id: event.id,
            raw_payload: subscription,
            error: 'Missing timestamp data',
            created_at: new Date().toISOString()
          });
          break;
        }

        // Convert timestamps to numbers
        const startTime = Number(startTimestamp);
        const endTime = Number(endTimestamp);

        if (isNaN(startTime) || isNaN(endTime)) {
          console.error('Invalid timestamp conversion:', { 
            startTime, 
            endTime, 
            original: { 
              startTimestamp, 
              endTimestamp,
              itemStart: subscriptionItem?.current_period_start,
              itemEnd: subscriptionItem?.current_period_end
            } 
          });
          // Store the event for manual review instead of failing
          await supabase.from('failed_webhook_events').insert({
            event_type: event.type,
            stripe_event_id: event.id,
            raw_payload: subscription,
            error: 'Invalid timestamp conversion',
            created_at: new Date().toISOString()
          });
          break;
        }

        await supabase
          .from('subscriptions')
          .update({
            status: subscription.status,
            current_period_start: new Date(startTime * 1000).toISOString(),
            current_period_end: new Date(endTime * 1000).toISOString(),
            updated_at: new Date().toISOString(),
            amount: amount ? amount / 100 : null, // Convert from cents to dollars
            currency: currency || null,
            billing_interval: interval || null,
            cancel_at_period_end: subscription.cancel_at_period_end || false,
            canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
            metadata: {
              ...subscription.metadata,
              stripe_price_id: price?.id,
              stripe_product_id: price?.product
            }
          })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
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
        const invoice = event.data.object;
        if (invoice.subscription) {
          console.log('Invoice payment payload:', {
            period_end: invoice.period_end,
            type: typeof invoice.period_end
          });

          const periodEndTimestamp = typeof invoice.period_end === 'number'
            ? invoice.period_end
            : parseInt(invoice.period_end);

          if (isNaN(periodEndTimestamp)) {
            console.error('Invalid period_end timestamp:', invoice.period_end);
            throw new Error('Invalid invoice period_end timestamp');
          }

          await supabase
            .from('subscriptions')
            .update({
              current_period_end: new Date(periodEndTimestamp * 1000).toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('stripe_subscription_id', invoice.subscription);

          const { data: subscription } = await supabase
            .from('subscriptions')
            .select('*, partner:partners(id, commission_rate)')
            .eq('stripe_subscription_id', invoice.subscription)
            .single();

          if (subscription?.partner?.id) {
            const commissionAmount = Math.floor(invoice.amount_paid * 0.20); // 20% commission
            await supabase
              .from('partner_payouts')
              .insert({
                partner_id: subscription.partner.id,
                amount: commissionAmount,
                status: 'pending',
                metadata: {
                  stripe_invoice_id: invoice.id,
                  stripe_subscription_id: invoice.subscription
                }
              });
          }
        }
        break;
      }
    }

    // Mark event as processed
    await supabase
      .from('stripe_events')
      .update({ processed: true })
      .eq('stripe_event_id', event.id);

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