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

interface OnboardingParams {
  partner_id: string;
  email: string;
  name: string;
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

    // Parse URL and get partner details
    const url = new URL(req.url);
    const partnerId = url.searchParams.get('partner_id');
    const email = url.searchParams.get('email');
    const name = url.searchParams.get('name');

    if (!partnerId || !email || !name) {
      throw new Error('partner_id, email, and name are required');
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if partner already exists
    const { data: existingPartner } = await supabase
      .from('partners')
      .select('id, stripe_account_id, status')
      .eq('id', partnerId)
      .single();

    if (!existingPartner) {
      throw new Error('Partner not found');
    }

    if (existingPartner.stripe_account_id) {
      // If partner already has a Stripe account, create a new account link for updating
      const accountLink = await stripe.accountLinks.create({
        account: existingPartner.stripe_account_id,
        refresh_url: `${APP_URL}/partner/onboarding/refresh?partner_id=${partnerId}`,
        return_url: `${APP_URL}/partner/onboarding/complete?partner_id=${partnerId}`,
        type: 'account_onboarding',
      });

      return new Response(
        JSON.stringify({ url: accountLink.url }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Create a new Stripe Connect Express account
    const account = await stripe.accounts.create({
      type: 'express',
      email: email,
      business_type: 'individual',
      capabilities: {
        transfers: { requested: true },
      },
      metadata: {
        partner_id: partnerId,
      },
      settings: {
        payouts: {
          schedule: {
            interval: 'monthly',
          },
        },
      },
    });

    // Update partner record with Stripe account ID
    const { error: updateError } = await supabase
      .from('partners')
      .update({
        stripe_account_id: account.id,
        status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', partnerId);

    if (updateError) {
      throw new Error(`Failed to update partner record: ${updateError.message}`);
    }

    // Create an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${APP_URL}/partner/onboarding/refresh?partner_id=${partnerId}`,
      return_url: `${APP_URL}/partner/onboarding/complete?partner_id=${partnerId}`,
      type: 'account_onboarding',
    });

    // Return the onboarding URL
    return new Response(
      JSON.stringify({
        url: accountLink.url,
        account_id: account.id,
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