import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { encrypt } from '../_shared/encryption.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

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
    const error = url.searchParams.get('error');
    const state = url.searchParams.get('state');
    
    // Log all request information
    console.log('Incoming request:', {
      url: req.url,
      method: req.method,
      headers: Object.fromEntries(req.headers),
      searchParams: Object.fromEntries(url.searchParams),
    });

    // Handle OAuth errors
    if (error) {
      console.error('HubSpot OAuth error:', error);
      return new Response(
        JSON.stringify({ error: 'OAuth error', details: error }),
        { 
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Check for authorization code
    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Missing code parameter' }),
        { 
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Exchange code for tokens
    const tokenRequestParams = {
      grant_type: 'authorization_code',
      client_id: '1a625962-e7a0-40e8-a54c-863a24acd1f0',
      client_secret: Deno.env.get('HUBSPOT_CLIENT_SECRET'),
      redirect_uri: 'https://rtalhjaoxlcqmxppuhhz.supabase.co/functions/v1/hubspot-oauth',
      code: code
    };

    console.log('Token request parameters:', tokenRequestParams);

    const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams(tokenRequestParams),
    });

    const tokenData = await tokenResponse.json();
    console.log('Token response:', {
      status: tokenResponse.status,
      statusText: tokenResponse.statusText,
      headers: Object.fromEntries(tokenResponse.headers),
      data: tokenData
    });

    if (!tokenResponse.ok) {
      return new Response(
        JSON.stringify({ 
          error: 'Token exchange failed', 
          details: tokenData,
          requestParams: tokenRequestParams 
        }, null, 2),
        {
          status: tokenResponse.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Get HubSpot account info
    const accountResponse = await fetch('https://api.hubapi.com/account-info/v3/details', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json',
      },
    });

    const accountInfo = await accountResponse.json();
    console.log('Account info:', accountInfo);

    // Store in Supabase
    const { data: hubspotAccount, error: upsertError } = await supabase
      .from('hubspot_accounts')
      .upsert({
        portal_id: accountInfo.portalId.toString(),
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
        token_type: tokenData.token_type,
        metadata: {
          accountType: accountInfo.accountType,
          timeZone: accountInfo.timeZone,
          currency: accountInfo.companyCurrency,
          uiDomain: accountInfo.uiDomain,
          dataHostingLocation: accountInfo.dataHostingLocation
        }
      })
      .select()
      .single();

    if (upsertError) {
      console.error('Failed to store account:', upsertError);
      return new Response(
        JSON.stringify({ 
          error: 'Database error', 
          details: upsertError 
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

    // Return success with stored data
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'HubSpot account connected successfully',
        account: {
          portal_id: hubspotAccount.portal_id,
          status: hubspotAccount.status,
          created_at: hubspotAccount.created_at,
          metadata: hubspotAccount.metadata
        }
      }, null, 2),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        stack: error.stack
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
}); 