import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { ScoringService } from "./scoringService.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface HubSpotWebhookEvent {
  subscriptionType: string;
  objectId: string;
  portalId: number;
  appId: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const event = await req.json() as HubSpotWebhookEvent;
    console.log('Received webhook event:', event);

    // Get HubSpot access token for this portal
    const { data: tokenData, error: tokenError } = await supabase
      .from('hubspot_tokens')
      .select('access_token')
      .eq('portal_id', event.portalId.toString())
      .single();

    if (tokenError || !tokenData) {
      console.error('Error getting access token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to get access token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const scoringService = new ScoringService(tokenData.access_token);

    // Handle different subscription types
    switch (event.subscriptionType) {
      case 'contact.creation':
      case 'contact.propertyChange':
        await scoringService.scoreContact(event.objectId);
        break;
      case 'company.creation':
      case 'company.propertyChange':
        await scoringService.scoreCompany(event.objectId);
        break;
      case 'deal.creation':
      case 'deal.propertyChange':
        await scoringService.scoreDeal(event.objectId);
        break;
      default:
        console.log('Unhandled subscription type:', event.subscriptionType);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}); 