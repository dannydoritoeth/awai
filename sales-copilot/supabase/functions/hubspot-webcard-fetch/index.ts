// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { decrypt } from '../_shared/encryption.ts';
import { HubspotClient } from '../_shared/hubspotClient.ts';

console.log('Hello from hubspot-webcard-fetch!')

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY')!;

async function getHubspotClient(portalId: string): Promise<HubspotClient> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Get the encrypted token from the database
  const { data: tokenData, error: tokenError } = await supabase
    .from('hubspot_tokens')
    .select('encrypted_access_token')
    .eq('portal_id', portalId)
    .single();

  if (tokenError || !tokenData) {
    console.error('Error fetching HubSpot token:', tokenError);
    throw new Error('HubSpot token not found');
  }

  // Decrypt the token
  const accessToken = decrypt(tokenData.encrypted_access_token, ENCRYPTION_KEY);
  return new HubspotClient(accessToken);
}

async function fetchHubspotData(objectId: string, objectType: string, portalId: string) {
  const client = await getHubspotClient(portalId);

  // Convert object type to lowercase and pluralize
  const normalizedType = objectType.toLowerCase() + 's';
  console.log('Normalized object type:', normalizedType);

  // Define properties to fetch based on object type
  let properties;
  if (normalizedType === 'contacts') {
    properties = ['ideal_client_score', 'ideal_client_summary', 'ideal_client_last_scored'];
  } else if (normalizedType === 'companies') {
    properties = ['company_fit_score', 'company_fit_summary', 'company_fit_last_scored'];
  } else if (normalizedType === 'deals') {
    properties = ['deal_quality_score', 'deal_quality_summary', 'deal_quality_last_scored'];
  } else {
    console.error('Invalid object type:', objectType, 'normalized:', normalizedType);
    throw new Error(`Unsupported object type: ${objectType} (normalized: ${normalizedType})`);
  }

  try {
    let record;
    if (normalizedType === 'contacts') {
      record = await client.getContact(objectId);
    } else if (normalizedType === 'companies') {
      record = await client.getCompany(objectId);
    } else if (normalizedType === 'deals') {
      record = await client.getDeal(objectId);
    }

    if (!record) {
      throw new Error(`Record not found: ${objectId}`);
    }

    console.log('HubSpot data received:', JSON.stringify(record, null, 2));

    // Get the appropriate score and summary based on object type
    let score = null;
    let summary = null;
    let lastScored = null;
    
    if (normalizedType === 'contacts') {
      score = record.properties?.ideal_client_score;
      summary = record.properties?.ideal_client_summary;
      lastScored = record.properties?.ideal_client_last_scored;
    } else if (normalizedType === 'companies') {
      score = record.properties?.company_fit_score;
      summary = record.properties?.company_fit_summary;
      lastScored = record.properties?.company_fit_last_scored;
    } else if (normalizedType === 'deals') {
      score = record.properties?.deal_quality_score;
      summary = record.properties?.deal_quality_summary;
      lastScored = record.properties?.deal_quality_last_scored;
    }

    console.log('Extracted data:', { score, summary, lastScored });
    return { score, summary, lastScored };
  } catch (error) {
    console.error('Error fetching HubSpot data:', error);
    throw error;
  }
}

async function calculateScore(data: any): Promise<{ score: number; explanation: string }> {
  // This is where you'll implement your scoring logic
  // For now returning mock data, but you'll want to calculate this based on the HubSpot data
  return {
    score: 76,
    explanation: "Based on recent interactions and profile data: Strong engagement from key decision makers, good budget alignment, and positive response to product demos. Some areas for attention include technical requirements validation and implementation timeline discussions."
  };
}

serve(async (req) => {
  // Enable CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    })
  }

  try {
    // Parse request parameters
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());
    console.log('Request received:', { params });

    if (!params.associatedObjectId || !params.associatedObjectType || !params.portalId) {
      console.error('Missing required parameters:', params);
      throw new Error('Missing required parameters: associatedObjectId, associatedObjectType, or portalId');
    }

    // Fetch data from HubSpot
    const { score, summary, lastScored } = await fetchHubspotData(
      params.associatedObjectId,
      params.associatedObjectType,
      params.portalId
    );

    // Format response in HubSpot's expected format for CRM cards
    const response = {"responseVersion":"v3","totalCount":1,"allItemsLinkUrl":"https://example.com/all-items-link-url","cardLabel":"Tickets","topLevelActions":{"settings":{"type":"IFRAME","url":"https://example.com/iframe-contents","label":"Edit","propertyNamesIncluded":["some_crm_property"],"width":640,"height":480,"type":"IFRAME"},"primary":{"type":"IFRAME","url":"https://example.com/primary-iframe","label":"test_label_primary","propertyNamesIncluded":[],"width":640,"height":480,"type":"IFRAME"},"secondary":[{"type":"IFRAME","url":"https://example.com/secondary-iframe","label":"test_label_secondary","propertyNamesIncluded":[],"width":640,"height":480,"type":"IFRAME"}]},"sections":[{"id":"123","title":"API-22: APIs working too fast","linkUrl":"http://example.com/1","tokens":[{"name":"created","label":"test_label","dataType":"DATE","value":"2016-08-04"}],"actions":[{"type":"ACTION_HOOK","url":"https://example.com/action-hook-frame","label":"action-hook-label","propertyNamesIncluded":["email","firstName"],"confirmation":null,"httpMethod":"POST","type":"ACTION_HOOK"},{"type":"ACTION_HOOK","url":"https://example.com/confirmation-action-hook","label":"confirmation-hook-label","propertyNamesIncluded":[],"confirmation":{"prompt":"action-confirmation-body-prompt","confirmButtonLabel":"Continue","cancelButtonLabel":"Cancel"},"httpMethod":"POST","type":"ACTION_HOOK"},{"type":"IFRAME","url":"https://example.com/iframe-action-label","label":"iframe-action-label","propertyNamesIncluded":["property1","property2","property3"],"width":640,"height":480,"type":"IFRAME"}]}]};

    console.log('Sending response:', JSON.stringify(response, null, 2));

    return new Response(
      JSON.stringify(response),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  } catch (error) {
    console.error('Error in hubspot-webcard-fetch:', error);
    return new Response(
      JSON.stringify({
        status: "ERROR",
        message: error.message || "Internal server error",
        correlationId: crypto.randomUUID(),
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/hubspot-webcard-fetch' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
