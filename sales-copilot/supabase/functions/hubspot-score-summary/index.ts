// @deno-types="https://deno.land/std@0.168.0/http/server.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @deno-types="npm:@supabase/supabase-js@2.38.4"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Logger } from "../_shared/logger.ts";
import { HubspotClient } from "../_shared/hubspotClient.ts";
import { decrypt, encrypt } from "../_shared/encryption.ts";
import { handleApiCall } from "../_shared/apiHandler.ts";

// Add Deno types
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const logger = new Logger("get-scoring-summary");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Define interface for summary object
interface SummaryObject {
  plan: {
    tier: string;
    isActive: boolean;
    isCanceledButActive: boolean;
    expiresAt: string | null;
    isExpiringSoon: boolean;
    amount: number;
    currency: string;
    billingInterval: string;
  };
  scoring: {
    used: number;
    total: number;
    remaining: number;
    periodStart: string;
    periodEnd: string;
    percentageUsed: number;
  };
  currentRecord?: {
    id: string;
    type: string;
    ideal_client_score?: string | null;
    ideal_client_summary?: string | null;
    error?: string;
  };
}

/**
 * Refreshes the HubSpot OAuth token
 */
async function refreshHubSpotToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  logger.info('Refreshing HubSpot token...');
  
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
    const errorText = await response.text();
    logger.error('Failed to refresh token:', errorText);
    throw new Error(`Failed to refresh HubSpot token: ${errorText}`);
  }

  const result = await response.json();
  logger.info('Successfully refreshed HubSpot token');
  return result;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse URL parameters
    const url = new URL(req.url);
    const portalId = url.searchParams.get('portalId');
    const objectType = url.searchParams.get('objectType'); // Optional
    const objectId = url.searchParams.get('objectId');     // Optional

    // Validate required parameters
    if (!portalId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required parameter: portalId must be provided in URL'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Create Supabase client directly
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // Get current period score count directly using the function from the migration
    const { data: scoreData, error: scoreError } = await supabaseClient
      .rpc('get_current_period_score_count', { portal_id_param: portalId })
      .single();

    if (scoreError) {
      logger.error('Error getting score count:', {
        error: scoreError,
        portalId
      });
    }

    // Get subscription status directly for plan details
    const { data: subscription, error: subError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .filter('metadata->>portal_id', 'eq', portalId.toString())
      .eq('status', 'active')
      .single();

    if (subError) {
      logger.error('Error getting subscription:', {
        error: subError,
        portalId
      });
    }

    // Format the response with available data
    const summary: SummaryObject = {
      plan: {
        tier: subscription?.plan_tier || 'FREE',
        isActive: !!subscription,
        isCanceledButActive: subscription?.cancel_at_period_end || false,
        expiresAt: subscription?.cancel_at || null,
        isExpiringSoon: false, // Can calculate this if needed
        amount: 0, // Price amount would need to be retrieved from prices table if needed
        currency: 'USD',
        billingInterval: 'month' // Default to monthly
      },
      scoring: {
        used: scoreData?.scores_used || 0,
        total: scoreData?.max_scores || 50, // Default to 50 for free tier
        remaining: (scoreData?.max_scores || 50) - (scoreData?.scores_used || 0),
        periodStart: scoreData?.period_start || new Date().toISOString(),
        periodEnd: scoreData?.period_end || new Date().toISOString(),
        percentageUsed: Math.round(((scoreData?.scores_used || 0) / (scoreData?.max_scores || 50)) * 100)
      }
    };

    // If objectType and objectId are provided, get the HubSpot object details
    if (objectType && objectId) {
      try {
        // Get HubSpot account details to initialize the client
        const { data: hubspotAccount, error: hsAccountError } = await supabaseClient
          .from('hubspot_accounts')
          .select('access_token, refresh_token, expires_at')
          .eq('portal_id', portalId)
          .single();

        if (hsAccountError) {
          throw new Error(`Failed to get HubSpot account: ${hsAccountError.message}`);
        }

        if (!hubspotAccount) {
          throw new Error('HubSpot account not found');
        }

        // Decrypt tokens
        const accessToken = await decrypt(hubspotAccount.access_token, Deno.env.get('ENCRYPTION_KEY')!);
        const refreshToken = await decrypt(hubspotAccount.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);
        
        // Initialize HubSpot client with the access token
        const hubspotClient = new HubspotClient(accessToken);
        
        // Function to get object details based on type
        const getObjectDetails = async () => {
          const properties = ['ideal_client_score', 'ideal_client_summary'];
          let hubspotObjectType;
          
          // Map our objectType to HubSpot API object type
          switch (objectType.toLowerCase()) {
            case 'deal':
              hubspotObjectType = 'deals';
              break;
            case 'contact':
              hubspotObjectType = 'contacts';
              break;
            case 'company':
              hubspotObjectType = 'companies';
              break;
            default:
              throw new Error(`Unsupported object type: ${objectType}`);
          }
          
          // Use the generic getRecord method for all object types
          return await hubspotClient.getRecord(hubspotObjectType, objectId, properties);
        };

        try {
          // Use handleApiCall utility to handle token refresh
          const objectDetails = await handleApiCall(
            hubspotClient, 
            portalId, 
            refreshToken, 
            getObjectDetails
          );
          
          // Add object details to the response
          summary.currentRecord = {
            id: objectId,
            type: objectType,
            ideal_client_score: objectDetails.properties?.ideal_client_score || null,
            ideal_client_summary: objectDetails.properties?.ideal_client_summary || null
          };
        } catch (apiError) {
          // Implement manual token refresh if the handleApiCall approach fails
          if (apiError.message?.includes('expired') || apiError.status === 401 || apiError.response?.status === 401) {
            logger.info('Token expired, refreshing...');
            
            // Refresh the token
            const newTokens = await refreshHubSpotToken(refreshToken);
            
            // Encrypt new tokens
            const newEncryptedToken = await encrypt(newTokens.access_token, Deno.env.get('ENCRYPTION_KEY')!);
            const newEncryptedRefreshToken = await encrypt(newTokens.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);
            
            // Update tokens in database
            await supabaseClient
              .from('hubspot_accounts')
              .update({
                access_token: newEncryptedToken,
                refresh_token: newEncryptedRefreshToken,
                expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('portal_id', portalId);
            
            // Update client with new token and retry
            hubspotClient.setToken?.(newTokens.access_token);
            
            // Retry with new token
            const objectDetails = await getObjectDetails();
            
            // Add object details to the response
            summary.currentRecord = {
              id: objectId,
              type: objectType,
              ideal_client_score: objectDetails.properties?.ideal_client_score || null,
              ideal_client_summary: objectDetails.properties?.ideal_client_summary || null
            };
          } else {
            throw apiError;
          }
        }
      } catch (hsError) {
        logger.error('Error getting HubSpot object details:', {
          error: hsError,
          portalId,
          objectType,
          objectId
        });
        // Don't fail the whole request if HubSpot fetching fails
        summary.currentRecord = {
          id: objectId,
          type: objectType,
          error: hsError.message
        };
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        result: summary
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    logger.error('Error getting scoring summary:', {
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
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
}); 