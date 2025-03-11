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
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const portalId = url.searchParams.get('portalId');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('HubSpot OAuth error:', {
        error,
        description: errorDescription,
        portalId
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

    if (!portalId) {
      return new Response('Missing portal ID', { 
        status: 400,
        headers: corsHeaders
      });
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: Deno.env.get('HUBSPOT_CLIENT_ID')!,
        client_secret: Deno.env.get('HUBSPOT_CLIENT_SECRET')!,
        redirect_uri: Deno.env.get('HUBSPOT_REDIRECT_URI')!,
        code,
      }),
    });

    const responseData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      const error = responseData as HubSpotErrorResponse;
      console.error('HubSpot token exchange failed:', {
        status: tokenResponse.status,
        error: error.error,
        description: error.error_description,
        correlationId: error.correlationId
      });
      return new Response(
        `Failed to exchange authorization code: ${error.error_description || error.message}`,
        { 
          status: 500,
          headers: corsHeaders
        }
      );
    }

    const tokens = responseData as HubSpotTokenResponse;

    // Verify HubSpot account access
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

    // Encrypt sensitive data
    const encryptedAccessToken = await encrypt(tokens.access_token, ENCRYPTION_KEY);
    const encryptedRefreshToken = await encrypt(tokens.refresh_token, ENCRYPTION_KEY);

    // Store in Supabase with encryption
    const { error: upsertError } = await supabase
      .from('hubspot_accounts')
      .upsert({
        portal_id: portalId,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
        token_type: tokens.token_type,
        last_verified: new Date().toISOString()
      });

    if (upsertError) {
      console.error('Failed to store tokens:', upsertError);
      return new Response('Failed to store authentication data', { 
        status: 500,
        headers: corsHeaders
      });
    }

    // Create success URL with state if provided
    const state = url.searchParams.get('state');
    const successUrl = new URL(`${Deno.env.get('APP_URL')}/hubspot/setup-success`);
    successUrl.searchParams.set('portal_id', portalId);
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
    return new Response('Internal server error', { 
      status: 500,
      headers: {
        ...corsHeaders,
        'Cache-Control': 'no-store'
      }
    });
  }
}); 