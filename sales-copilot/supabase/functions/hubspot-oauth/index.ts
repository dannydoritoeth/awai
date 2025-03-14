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

async function createHubSpotProperties(accessToken: string) {
  const propertyGroup = {
    name: "sales_copilot",
    label: "Sales Copilot",
    displayOrder: -1
  };

  const properties = [
    // Contact Properties
    {
      name: "ideal_client_score",
      label: "Ideal Client Score",
      groupName: "sales_copilot",
      type: "number",
      fieldType: "number",
      description: "Score indicating how well this contact matches ideal client criteria",
      displayOrder: 1,
      hasUniqueValue: false,
      formField: true
    },
    {
      name: "ideal_client_summary",
      label: "Ideal Client Summary",
      groupName: "sales_copilot",
      type: "textarea",
      fieldType: "textarea",
      description: "Summary of ideal client match analysis",
      displayOrder: 2,
      hasUniqueValue: false,
      formField: true
    },
    {
      name: "ideal_client_last_scored",
      label: "Last Scored Date",
      groupName: "sales_copilot",
      type: "datetime",
      fieldType: "datetime",
      description: "When this contact was last evaluated",
      displayOrder: 3,
      hasUniqueValue: false,
      formField: true
    }
  ];

  try {
    // Create property groups and properties for each object type
    const objectTypes = [
      { name: 'contacts', propertyPrefix: 'ideal_client' },
      { name: 'companies', propertyPrefix: 'company_fit' },
      { name: 'deals', propertyPrefix: 'deal_quality' }
    ];

    for (const objectType of objectTypes) {
      console.log(`Creating property group for ${objectType.name}...`);
      
      // Create property group
      const groupResponse = await fetch(`https://api.hubapi.com/properties/v2/${objectType.name}/groups`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(propertyGroup)
      });

      if (!groupResponse.ok && groupResponse.status !== 409) { // 409 means group already exists
        const errorData = await groupResponse.json();
        console.error(`Failed to create property group for ${objectType.name}:`, errorData);
        throw new Error(`Failed to create property group for ${objectType.name}: ${groupResponse.statusText}`);
      }

      // Create properties
      const objectProperties = properties.map(prop => ({
        ...prop,
        name: prop.name.replace('ideal_client', objectType.propertyPrefix)
      }));

      for (const property of objectProperties) {
        console.log(`Creating property ${property.name} for ${objectType.name}...`);
        
        const propertyResponse = await fetch(`https://api.hubapi.com/properties/v2/${objectType.name}/properties`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(property)
        });

        if (!propertyResponse.ok && propertyResponse.status !== 409) { // 409 means property already exists
          const errorData = await propertyResponse.json();
          console.error(`Failed to create property ${property.name} for ${objectType.name}:`, errorData);
          throw new Error(`Failed to create property ${property.name} for ${objectType.name}: ${propertyResponse.statusText}`);
        }
      }
    }

    console.log('Successfully created all properties');
    return true;
  } catch (error) {
    console.error('Error creating HubSpot properties:', error);
    throw error; // Re-throw to handle in the main function
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Received request:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', JSON.stringify(Object.fromEntries(req.headers.entries())));

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    
    console.log('Authorization code:', code);

    if (!code) {
      console.error('No authorization code provided');
      return new Response(
        JSON.stringify({ 
          error: 'No authorization code provided',
          success: false 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

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

    // After successfully getting and storing tokens
    try {
      await createHubSpotProperties(tokenData.access_token);
      console.log('Successfully created HubSpot properties');
    } catch (error) {
      console.error('Failed to create HubSpot properties:', error);
      // Continue with the success response even if property creation fails
      // This allows the app to still function and retry property creation later if needed
    }

    return new Response(
      JSON.stringify({ 
        message: "Successfully authenticated and created custom properties",
        success: true,
        portal_id: accountInfo.portalId.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
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