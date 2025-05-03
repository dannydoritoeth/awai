import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import Stripe from 'https://esm.sh/stripe@13.10.0';
import { corsHeaders } from '../_shared/cors.ts';
import { Logger } from '../_shared/logger.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

interface PartnerPayout {
  partner_id: string;
  amount: number;
  status: string;
  payout_date: string;
  stripe_transfer_id?: string;
  metadata: Record<string, any>;
}

async function processPartnerPayouts(logger: Logger) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();
  
  // Check if it's the 15th day of the month
  if (now.getDate() !== 15) {
    logger.info('Not payout day (15th). Skipping payout processing.');
    return { processed: 0, message: 'Not payout day' };
  }

  // Calculate the date range for the previous month
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startDate = previousMonth.toISOString().split('T')[0];
  const endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

  logger.info(`Processing payouts for date range: ${startDate} to ${endDate}`);

  // Get all partners with their Stripe connect accounts
  const { data: partners, error: partnersError } = await supabase
    .from('partners')
    .select('id, stripe_connect_account_id')
    .not('stripe_connect_account_id', 'is', null);

  if (partnersError) {
    throw new Error(`Error fetching partners: ${partnersError.message}`);
  }

  let processedCount = 0;

  for (const partner of partners) {
    try {
      // Calculate total pending payouts for the partner
      const { data: payouts, error: payoutsError } = await supabase
        .from('partner_payouts')
        .select('id, amount, status, metadata')
        .eq('partner_id', partner.id)
        .eq('status', 'pending')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (payoutsError) {
        logger.error(`Error fetching payouts for partner ${partner.id}: ${payoutsError.message}`);
        continue;
      }

      // Calculate total amount including any negative balances from refunds/chargebacks
      const totalAmount = payouts.reduce((sum, payout) => sum + payout.amount, 0);

      // Skip if total amount is less than $50
      if (totalAmount < 5000) { // Amount in cents
        logger.info(`Partner ${partner.id} total amount ${totalAmount} cents is below minimum threshold. Skipping.`);
        continue;
      }

      // Create Stripe transfer
      const transfer = await stripe.transfers.create({
        amount: totalAmount,
        currency: 'usd',
        destination: partner.stripe_connect_account_id,
        metadata: {
          partner_id: partner.id,
          payout_period_start: startDate,
          payout_period_end: endDate
        }
      });

      // Update all processed payouts
      const { error: updateError } = await supabase
        .from('partner_payouts')
        .update({
          status: 'paid',
          payout_date: now.toISOString(),
          stripe_transfer_id: transfer.id,
          metadata: {
            ...payouts[0].metadata,
            stripe_transfer: transfer
          }
        })
        .in('id', payouts.map(p => p.id));

      if (updateError) {
        logger.error(`Error updating payouts for partner ${partner.id}: ${updateError.message}`);
        // Consider reverting the Stripe transfer here if needed
        continue;
      }

      processedCount++;
      logger.info(`Successfully processed payout for partner ${partner.id}: ${totalAmount} cents`);

    } catch (error) {
      logger.error(`Error processing payout for partner ${partner.id}: ${error.message}`);
    }
  }

  return { processed: processedCount, message: 'Payouts processed successfully' };
}

serve(async (req) => {
  const logger = new Logger();

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Process the payouts
    const result = await processPartnerPayouts(logger);

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    logger.error('Error:', error);
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