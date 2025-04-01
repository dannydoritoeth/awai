import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { HubspotClient } from '../_shared/hubspotClient.ts'
import { decrypt, encrypt } from '../_shared/encryption.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Minimum required training counts for each type
const MIN_TRAINING_COUNTS = {
  companies: 10,
  contacts: 10,
  deals: 10
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
    const portalId = url.searchParams.get('portalId');
    const recordType = url.searchParams.get('recordType');
    const recordId = url.searchParams.get('recordId');

    // Log all search params
    console.log('All URL search params:', Object.fromEntries(url.searchParams.entries()));
    console.log('Full URL:', url.toString());
    console.log('Individual params:', {
      portalId,
      recordType,
      recordId,
      hasPortalId: !!portalId,
      hasRecordType: !!recordType,
      hasRecordId: !!recordId
    });

    if (!portalId) {
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
        access_token,
        refresh_token,
        expires_at
      `)
      .eq('portal_id', portalId)
      .single()

    if (accountError) {
      console.error('Database error:', accountError);
      throw new Error(`Error fetching account data: ${accountError.message}`)
    }

    console.log('Account data:', accountData);

    let currentRecord = null;

    // Get current record's score from HubSpot if recordId and recordType provided
    if (recordId && recordType && accountData.access_token) {
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
              .eq('portal_id', portalId);
              
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

        console.log('Fetching HubSpot record data...');
        const properties = ['ideal_client_score', 'ideal_client_summary'];
        console.log(`Getting ${recordType} record ${recordId} with properties:`, properties);
        
        const hubspotData = await hubspotClient.getRecord(recordType, recordId, properties);
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
        hasRecordId: !!recordId,
        hasRecordType: !!recordType,
        hasAccessToken: !!accountData?.access_token
      });
    }

    // Return the counts and current record data
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
              ideal: MIN_TRAINING_COUNTS.companies,
              less_ideal: MIN_TRAINING_COUNTS.companies
            }
          },
          contacts: {
            current: {
              ideal: accountData?.current_ideal_contacts || 0,
              less_ideal: accountData?.current_less_ideal_contacts || 0
            },
            required: {
              ideal: MIN_TRAINING_COUNTS.contacts,
              less_ideal: MIN_TRAINING_COUNTS.contacts
            }
          },
          deals: {
            current: {
              ideal: accountData?.current_ideal_deals || 0,
              less_ideal: accountData?.current_less_ideal_deals || 0
            },
            required: {
              ideal: MIN_TRAINING_COUNTS.deals,
              less_ideal: MIN_TRAINING_COUNTS.deals
            }
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