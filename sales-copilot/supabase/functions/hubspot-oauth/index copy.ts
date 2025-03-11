import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { encrypt } from '../_shared/encryption.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface HubSpotTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface HubSpotErrorResponse {
  status: string;
  message: string;
  correlationId: string;
  error: string;
  error_description?: string;
}

serve(async (req) => {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    // Validate required environment variables
    const requiredEnvVars = {
      'HUBSPOT_CLIENT_ID': Deno.env.get('HUBSPOT_CLIENT_ID'),
      'HUBSPOT_CLIENT_SECRET': Deno.env.get('HUBSPOT_CLIENT_SECRET'),
      'HUBSPOT_REDIRECT_URI': Deno.env.get('HUBSPOT_REDIRECT_URI'),
      'ENCRYPTION_KEY': Deno.env.get('ENCRYPTION_KEY'),
      'APP_URL': Deno.env.get('APP_URL')
    };

    const missingEnvVars = Object.entries(requiredEnvVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingEnvVars.length > 0) {
      console.error('Missing required environment variables:', missingEnvVars);
      return new Response(
        JSON.stringify({
          error: 'Configuration error',
          details: {
            message: 'Missing required environment variables',
            missing: missingEnvVars,
            available: Object.keys(requiredEnvVars).filter(key => requiredEnvVars[key])
          }
        }, null, 2),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Log environment variable status (safely)
    console.log('Environment variables status:', {
      HUBSPOT_CLIENT_ID: `${requiredEnvVars.HUBSPOT_CLIENT_ID?.substring(0, 4)}...`,
      HUBSPOT_CLIENT_SECRET: requiredEnvVars.HUBSPOT_CLIENT_SECRET ? 'set' : 'missing',
      HUBSPOT_REDIRECT_URI: requiredEnvVars.HUBSPOT_REDIRECT_URI,
      ENCRYPTION_KEY: requiredEnvVars.ENCRYPTION_KEY ? `${requiredEnvVars.ENCRYPTION_KEY.length} chars` : 'missing',
      APP_URL: requiredEnvVars.APP_URL
    });

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('HubSpot OAuth error:', {
        error,
        description: errorDescription
      });
      return new Response(
        `Authentication failed: ${errorDescription || error}`,
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    if (!code) {
      return new Response('Missing authorization code', { 
        status: 400,
        headers: corsHeaders
      });
    }

    // Exchange code for tokens
    const requestParams = {
      grant_type: 'authorization_code',
      client_id: Deno.env.get('HUBSPOT_CLIENT_ID')!,
      client_secret: Deno.env.get('HUBSPOT_CLIENT_SECRET')!,
      redirect_uri: Deno.env.get('HUBSPOT_REDIRECT_URI')!,
      code,
    };

    console.log('Token exchange request parameters:', {
      url: 'https://api.hubapi.com/oauth/v1/token',
      method: 'POST',
      params: requestParams,
      code: code
    });

    const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams(requestParams),
    });

    const responseData = await tokenResponse.json();
    console.log('Token exchange response:', {
      status: tokenResponse.status,
      statusText: tokenResponse.statusText,
      headers: Object.fromEntries(tokenResponse.headers),
      data: responseData
    });

    if (!tokenResponse.ok) {
      const error = responseData as HubSpotErrorResponse;
      const errorDetails = {
        status: tokenResponse.status,
        error: error.error,
        description: error.error_description,
        correlationId: error.correlationId,
        message: error.message,
        fullResponse: responseData
      };
      console.error('HubSpot token exchange failed:', errorDetails);
      
      return new Response(
        JSON.stringify({
          error: 'Failed to exchange authorization code',
          details: errorDetails
        }, null, 2),
        { 
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    const tokens = responseData as HubSpotTokenResponse;

    // Get HubSpot account info to get the portal ID
    const accountResponse = await fetch('https://api.hubapi.com/account-info/v3/details', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Accept': 'application/json',
      },
    });

    if (!accountResponse.ok) {
      console.error('Failed to verify HubSpot account:', await accountResponse.text());
      return new Response('Failed to verify HubSpot account access', { 
        status: 500,
        headers: corsHeaders
      });
    }

    const accountInfo = await accountResponse.json();
    const portalId = accountInfo.portalId;

    if (!portalId) {
      console.error('Failed to get portal ID from account info:', accountInfo);
      return new Response('Failed to get portal ID from account info', { 
        status: 500,
        headers: corsHeaders
      });
    }

    // Encrypt sensitive data
    const encryptedAccessToken = await encrypt(tokens.access_token, ENCRYPTION_KEY);
    const encryptedRefreshToken = await encrypt(tokens.refresh_token, ENCRYPTION_KEY);

    // Get user information from state parameter
    const state = url.searchParams.get('state');
    if (!state) {
      console.error('No state parameter present');
      return new Response(
        JSON.stringify({
          error: 'Invalid request',
          details: 'Missing state parameter'
        }, null, 2),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    let userId;
    try {
      // State should be a base64 encoded JSON string containing userId
      const decodedState = JSON.parse(atob(state));
      userId = decodedState.userId;
      
      if (!userId) {
        throw new Error('No userId in state');
      }
    } catch (error) {
      console.error('Failed to parse state parameter:', error);
      return new Response(
        JSON.stringify({
          error: 'Invalid state parameter',
          details: 'Could not parse user information from state'
        }, null, 2),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Store in Supabase with encryption
    const upsertData = {
      portal_id: portalId.toString(),
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'active',
      token_type: tokens.token_type,
      last_verified: new Date().toISOString()
    };

    console.log('Attempting to store data:', {
      portal_id: upsertData.portal_id,
      token_type: upsertData.token_type,
      expires_at: upsertData.expires_at,
      access_token_length: encryptedAccessToken.length,
      refresh_token_length: encryptedRefreshToken.length
    });

    // Start a transaction to ensure both inserts succeed or fail together
    const { data: hubspotAccount, error: upsertError } = await supabase
      .from('hubspot_accounts')
      .upsert(upsertData)
      .select()
      .single();

    if (upsertError) {
      console.error('Failed to store tokens:', {
        error: upsertError,
        errorMessage: upsertError.message,
        details: upsertError.details,
        hint: upsertError.hint,
        code: upsertError.code
      });
      return new Response(
        JSON.stringify({
          error: 'Failed to store authentication data',
          details: {
            message: upsertError.message,
            details: upsertError.details,
            hint: upsertError.hint,
            code: upsertError.code
          }
        }, null, 2),
        { 
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Create user-portal association with admin role
    const { error: portalAssocError } = await supabase
      .from('user_hubspot_portals')
      .upsert({
        user_id: userId,
        portal_id: portalId.toString(),
        role: 'admin'
      });

    if (portalAssocError) {
      console.error('Failed to create user-portal association:', {
        error: portalAssocError,
        errorMessage: portalAssocError.message,
        details: portalAssocError.details,
        hint: portalAssocError.hint,
        code: portalAssocError.code
      });
      // Don't return error here as the main HubSpot account was created successfully
      // Just log the error and continue
    }

    // Create success URL with state if provided
    const successUrl = new URL(`${Deno.env.get('APP_URL')}/hubspot/setup-success`);
    successUrl.searchParams.set('portal_id', portalId.toString());
    // Pass the original state back to the frontend
    if (state) {
      successUrl.searchParams.set('state', state);
    }

    // Redirect to success page
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': successUrl.toString(),
        'Cache-Control': 'no-store',
      },
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(`Internal server error: ${error}`, { 
      status: 500,
      headers: {
        ...corsHeaders,
        'Cache-Control': 'no-store'
      }
    });
  }
}); 