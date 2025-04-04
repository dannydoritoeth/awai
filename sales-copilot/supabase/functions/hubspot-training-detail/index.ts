import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { HubspotClient } from '../_shared/hubspotClient.ts'
import { decrypt } from '../_shared/encryption.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse URL parameters
    const url = new URL(req.url);
    const portalId = url.searchParams.get('portalId');
    const recordType = url.searchParams.get('recordType');
    const recordId = url.searchParams.get('recordId');
    const action = url.searchParams.get('action');

    // Validate required parameters
    if (!portalId || !recordType || !recordId || !action) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required parameters: portalId, recordType, recordId, and action must be provided in URL'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Get HubSpot access token
    const { data: accountData } = await supabase
      .from('hubspot_accounts')
      .select('refresh_token, access_token')
      .eq('portal_id', portalId)
      .single();

    if (!accountData?.access_token) {
      throw new Error('No access token found for portal');
    }

    // Decrypt tokens
    const decryptedToken = await decrypt(accountData.access_token, Deno.env.get('ENCRYPTION_KEY')!);
    const decryptedRefreshToken = await decrypt(accountData.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);

    if (!decryptedToken || !decryptedRefreshToken) {
      throw new Error('HubSpot tokens are missing or invalid');
    }

    const hubspotClient = new HubspotClient(decryptedToken);

    if (action === 'get') {
      // Fetch current training data from HubSpot
      const properties = ['training_score', 'training_notes'];
      const hubspotData = await hubspotClient.getRecord(recordType, recordId, properties);
      console.log('HubSpot response:', hubspotData);

      return new Response(
        JSON.stringify({
          success: true,
          result: {
            training_score: hubspotData?.properties?.training_score || '',
            training_notes: hubspotData?.properties?.training_notes || ''
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    } else if (action === 'counts') {
      // Get account settings from database
      const { data: accountData, error: accountError } = await supabase
        .from('hubspot_accounts')
        .select(`
          current_ideal_companies,
          current_less_ideal_companies,
          current_ideal_contacts,
          current_less_ideal_contacts,
          current_ideal_deals,
          current_less_ideal_deals,
          minimum_ideal_companies,
          minimum_less_ideal_companies,
          minimum_ideal_contacts,
          minimum_less_ideal_contacts,
          minimum_ideal_deals,
          minimum_less_ideal_deals
        `)
        .eq('portal_id', portalId)
        .single();

      if (accountError) {
        throw new Error(`Error fetching account data: ${accountError.message}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          result: {
            companies: {
              current: {
                ideal: accountData?.current_ideal_companies || 0,
                less_ideal: accountData?.current_less_ideal_companies || 0
              },
              required: {
                ideal: accountData?.minimum_ideal_companies || 0,
                less_ideal: accountData?.minimum_less_ideal_companies || 0
              }
            },
            contacts: {
              current: {
                ideal: accountData?.current_ideal_contacts || 0,
                less_ideal: accountData?.current_less_ideal_contacts || 0
              },
              required: {
                ideal: accountData?.minimum_ideal_contacts || 0,
                less_ideal: accountData?.minimum_less_ideal_contacts || 0
              }
            },
            deals: {
              current: {
                ideal: accountData?.current_ideal_deals || 0,
                less_ideal: accountData?.current_less_ideal_deals || 0
              },
              required: {
                ideal: accountData?.minimum_ideal_deals || 0,
                less_ideal: accountData?.minimum_less_ideal_deals || 0
              }
            }
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    } else if (action === 'update') {
      // Get training data from URL parameters
      const training_score = url.searchParams.get('training_score');
      const training_notes = url.searchParams.get('training_notes');

      console.log('Received training data from params:', {
        training_score,
        training_notes
      });

      // Validate training data
      const receivedScore = training_score;
      const score = typeof receivedScore === 'number' 
        ? receivedScore 
        : Number(receivedScore);

      console.log('Score validation:', { 
        receivedScore,
        receivedType: typeof receivedScore,
        parsedScore: score,
        parsedType: typeof score
      });

      if (isNaN(score) || score < 0 || score > 100) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Score must be a number between 0 and 100',
            debug: {
              receivedScore,
              receivedType: typeof receivedScore,
              parsedScore: score,
              parsedType: typeof score,
              isNaN: isNaN(score),
              isLessThanZero: score < 0,
              isGreaterThan100: score > 100
            }
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          }
        );
      }

      // Update properties in HubSpot
      const properties: Record<string, string> = {
        training_score: score.toString()
      };

      if (training_notes) {
        properties.training_notes = training_notes;
      }

      switch (recordType) {
        case 'company':
          await hubspotClient.updateCompany(recordId, properties);
          break;
        case 'contact':
          await hubspotClient.updateContact(recordId, properties);
          break;
        case 'deal':
          await hubspotClient.updateDeal(recordId, properties);
          break;
        default:
          throw new Error(`Unsupported record type: ${recordType}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          result: {
            training_score: score,
            ...(training_notes ? { training_notes } : {})
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invalid action. Must be either "get", "counts", or "update"'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        details: error.stack,
        debug: { error }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
}); 