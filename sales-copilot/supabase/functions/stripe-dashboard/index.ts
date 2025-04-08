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

    // Parse URL and get partner_id
    const url = new URL(req.url);
    const partnerId = url.searchParams.get('partner_id');

    if (!partnerId) {
      throw new Error('partner_id is required');
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get partner details from database
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('stripe_account_id, status, onboarding_completed')
      .eq('id', partnerId)
      .single();

    if (partnerError || !partner) {
      throw new Error('Partner not found');
    }

    if (!partner.stripe_account_id) {
      throw new Error('Partner has no associated Stripe account');
    }

    // Verify partner account status
    const account = await stripe.accounts.retrieve(partner.stripe_account_id);

    if (!account || account.type !== 'express') {
      throw new Error('Invalid Stripe account type');
    }

    // If account is not fully onboarded, create an onboarding link instead
    if (!account.details_submitted || !account.payouts_enabled) {
      const accountLink = await stripe.accountLinks.create({
        account: partner.stripe_account_id,
        refresh_url: `${APP_URL}/partner/onboarding/refresh?partner_id=${partnerId}`,
        return_url: `${APP_URL}/partner/onboarding/complete?partner_id=${partnerId}`,
        type: 'account_onboarding',
      });

      return new Response(
        JSON.stringify({
          url: accountLink.url,
          status: 'requires_onboarding',
          details_submitted: account.details_submitted,
          payouts_enabled: account.payouts_enabled,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Create login link for the Express dashboard
    const loginLink = await stripe.accounts.createLoginLink(
      partner.stripe_account_id,
      {
        redirect_url: `${APP_URL}/partner/dashboard?partner_id=${partnerId}`,
      }
    );

    // Update partner status if needed
    if (!partner.onboarding_completed) {
      await supabase
        .from('partners')
        .update({
          status: 'active',
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', partnerId);
    }

    // Return the dashboard URL
    return new Response(
      JSON.stringify({
        url: loginLink.url,
        status: 'active',
        details_submitted: account.details_submitted,
        payouts_enabled: account.payouts_enabled,
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