import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { HubspotClient } from '../_shared/hubspotClient.ts'
import { decrypt, encrypt } from '../_shared/encryption.ts'
import { createIdealDealsSearchCriteria, createNonIdealDealsSearchCriteria } from '../_shared/hubspotQueries.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}



async function refreshHubSpotToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: Deno.env.get('HUBSPOT_CLIENT_ID')!,
      client_secret: Deno.env.get('HUBSPOT_CLIENT_SECRET')!,
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to refresh token:', error);
    throw new Error('Failed to refresh HubSpot token');
  }

  return response.json();
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get parameters from URL
    const url = new URL(req.url);
    const portal_id = url.searchParams.get('portal_id');
    const object_type = url.searchParams.get('object_type');
    const object_id = url.searchParams.get('object_id');

    // Log all search params
    console.log('All URL search params:', Object.fromEntries(url.searchParams.entries()));
    console.log('Full URL:', url.toString());
    console.log('Individual params:', {
      portal_id,
      object_type,
      object_id,
      hasPortalId: !!portal_id,
      hasObjectType: !!object_type,
      hasObjectId: !!object_id
    });

    if (!portal_id) {
      throw new Error('Portal ID is required')
    }

    // Query hubspot_accounts table for the account settings
    const { data: accountData, error: accountError } = await supabaseClient
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
        minimum_less_ideal_deals,
        ideal_low,
        ideal_high,
        ideal_median,
        ideal_count,
        ideal_last_trained,
        nonideal_low,
        nonideal_high,
        nonideal_median,
        nonideal_count,
        nonideal_last_trained,
        access_token,
        refresh_token,
        expires_at
      `)
      .eq('portal_id', portal_id)
      .single()

    if (accountError) {
      console.error('Database error:', accountError);
      throw new Error(`Error fetching account data: ${accountError.message}`)
    }

    console.log('Account data:', accountData);

    let currentRecord = null;
    let ideal_deals_to_train = 0;
    let nonideal_deals_to_train = 0;

    // Get current record's score from HubSpot if object_id and object_type provided
    if (accountData.access_token) {
      try {
        // Decrypt tokens
        let decryptedToken = await decrypt(accountData.access_token, Deno.env.get('ENCRYPTION_KEY')!);
        const decryptedRefreshToken = await decrypt(accountData.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);
        
        if (!decryptedToken || !decryptedRefreshToken) {
          throw new Error('HubSpot tokens are missing or invalid');
        }

        console.log('Creating HubSpot client with token:', decryptedToken.substring(0, 10) + '...');
        const hubspotClient = new HubspotClient(decryptedToken);

        // Try to make a test request to validate the token
        try {
          await hubspotClient.searchRecords('contacts', { limit: 1 });
        } catch (error) {
          if (error.message.includes('expired')) {
            console.log('Token validation failed, refreshing...');
            const newTokens = await refreshHubSpotToken(decryptedRefreshToken);
            
            // Encrypt new tokens
            const newEncryptedToken = await encrypt(newTokens.access_token, Deno.env.get('ENCRYPTION_KEY')!);
            const newEncryptedRefreshToken = await encrypt(newTokens.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);
            
            // Update tokens in database
            const { error: updateError } = await supabaseClient
              .from('hubspot_accounts')
              .update({
                access_token: newEncryptedToken,
                refresh_token: newEncryptedRefreshToken,
                expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('portal_id', portal_id);
              
            if (updateError) {
              throw new Error('Failed to update HubSpot tokens');
            }
            
            // Update the client with the new token
            decryptedToken = newTokens.access_token;
            hubspotClient.updateToken(newTokens.access_token);
            console.log('Successfully refreshed and updated tokens');
          } else {
            throw error;
          }
        }

        // Get the current record's data if object_id and object_type are provided
        if (object_id && object_type) {
          console.log('Fetching HubSpot record data...');
          const properties = ['ideal_client_score', 'ideal_client_summary'];
          console.log(`Getting ${object_type} record ${object_id} with properties:`, properties);
          
          const hubspotData = await hubspotClient.getRecord(object_type, object_id, properties);
          console.log('HubSpot response:', hubspotData);

          if (hubspotData?.properties) {
            currentRecord = {
              ideal_client_score: hubspotData.properties.ideal_client_score,
              ideal_client_summary: hubspotData.properties.ideal_client_summary
            };
            console.log('Extracted current record:', currentRecord);
          } else {
            console.log('No properties found in HubSpot response');
          }
        }

        // Count deals that need training
        try {
          // Count ideal deals (won in last 90 days)
          console.log('Counting ideal deals (won in last 90 days)...');
          const idealSearchCriteria = createIdealDealsSearchCriteria(1);
          
          const idealDealsResponse = await hubspotClient.searchRecords('deals', idealSearchCriteria);
          ideal_deals_to_train = idealDealsResponse.total || 0;
          console.log(`Found ${ideal_deals_to_train} ideal deals (won in last 90 days) to train`);

          // Count non-ideal deals (lost in last 90 days)
          console.log('Counting non-ideal deals (lost in last 90 days)...');
          const nonIdealSearchCriteria = createNonIdealDealsSearchCriteria(1);
          
          const nonIdealDealsResponse = await hubspotClient.searchRecords('deals', nonIdealSearchCriteria);
          nonideal_deals_to_train = nonIdealDealsResponse.total || 0;
          console.log(`Found ${nonideal_deals_to_train} non-ideal deals (lost in last 90 days) to train`);
        } catch (countError) {
          console.error('Error counting deals to train:', countError);
          // Just continue with zero counts
        }
      } catch (error) {
        console.error('HubSpot API error details:', {
          message: error.message,
          stack: error.stack,
          error
        });
        // Don't throw error, just log it and continue without current record data
      }
    } else {
      console.log('Skipping HubSpot API call, missing required data:', {
        hasRecordId: !!object_id,
        hasRecordType: !!object_type,
        hasAccessToken: !!accountData?.access_token
      });
    }

    // Prepare the deal statistics data
    const dealStatistics = {
      ideal: {
        low: accountData?.ideal_low || 0,
        high: accountData?.ideal_high || 0,
        median: accountData?.ideal_median || 0,
        count: accountData?.ideal_count || 0,
        last_trained: accountData?.ideal_last_trained || null,
        to_train: ideal_deals_to_train
      },
      nonideal: {
        low: accountData?.nonideal_low || 0,
        high: accountData?.nonideal_high || 0,
        median: accountData?.nonideal_median || 0,
        count: accountData?.nonideal_count || 0,
        last_trained: accountData?.nonideal_last_trained || null,
        to_train: nonideal_deals_to_train
      }
    };

    // Return the counts, current record data, and deal statistics
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
            },
            statistics: dealStatistics
          },
          currentRecord
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
}) 