import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Logger } from "../_shared/logger.ts";

const logger = new Logger("generate-signup-url");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HUBSPOT_SCOPES = [
  'crm.schemas.deals.read',
  'crm.objects.contacts.write',
  'crm.objects.companies.write',
  'crm.objects.companies.read',
  'crm.objects.deals.read',
  'crm.schemas.contacts.read',
  'crm.objects.deals.write',
  'crm.objects.contacts.read',
  'crm.schemas.companies.read'
].join(' ');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const partnerId = url.searchParams.get('partner_id');

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // If partner_id is provided, verify it exists
    if (partnerId) {
      const { data: partner, error } = await supabase
        .from('partners')
        .select('id, status')
        .eq('id', partnerId)
        .single();

      if (error || !partner) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Invalid partner ID' 
          }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      if (partner.status !== 'active') {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Partner account is not active' 
          }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Generate state parameter to include partner_id if provided
    const state = partnerId ? JSON.stringify({ partner_id: partnerId }) : '';

    // Construct the HubSpot OAuth URL
    const hubspotUrl = new URL('https://app.hubspot.com/oauth/authorize');
    hubspotUrl.searchParams.set('client_id', Deno.env.get('HUBSPOT_CLIENT_ID')!);
    hubspotUrl.searchParams.set('redirect_uri', `${Deno.env.get('SUPABASE_URL')}/functions/v1/hubspot-oauth`);
    hubspotUrl.searchParams.set('scope', HUBSPOT_SCOPES);
    if (state) {
      hubspotUrl.searchParams.set('state', state);
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: hubspotUrl.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    logger.error('Error generating signup URL:', {
      error,
      message: error.message,
      stack: error.stack
    });
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Internal server error',
        details: error.stack || 'No stack trace available'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}); 