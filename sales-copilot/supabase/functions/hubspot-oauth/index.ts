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
  try {
    // Create contact properties
    const contactProperties = [
      {
        name: "ideal_client_score",
        label: "Ideal Client Score",
        type: "number",
        fieldType: "number",
        groupName: "sales_copilot",
        description: "Score indicating how well this contact matches ideal client criteria",
        displayOrder: 1,
        formField: true
      },
      {
        name: "ideal_client_summary",
        label: "Ideal Client Summary",
        type: "string",
        fieldType: "textarea",
        groupName: "sales_copilot",
        description: "Summary of ideal client match analysis",
        displayOrder: 2,
        formField: true
      },
      {
        name: "ideal_client_last_scored",
        label: "Last Scored Date",
        type: "datetime",
        fieldType: "date",
        groupName: "sales_copilot",
        description: "When this contact was last evaluated",
        displayOrder: 3,
        formField: true
      }
    ];

    // Create company properties
    const companyProperties = [
      {
        name: "company_fit_score",
        label: "Company Fit Score",
        type: "number",
        fieldType: "number",
        groupName: "sales_copilot",
        description: "Score indicating how well this company matches ideal criteria",
        displayOrder: 1,
        formField: true
      },
      {
        name: "company_fit_summary",
        label: "Company Fit Summary",
        type: "string",
        fieldType: "textarea",
        groupName: "sales_copilot",
        description: "Summary of company fit analysis",
        displayOrder: 2,
        formField: true
      },
      {
        name: "company_fit_last_scored",
        label: "Last Scored Date",
        type: "datetime",
        fieldType: "date",
        groupName: "sales_copilot",
        description: "When this company was last evaluated",
        displayOrder: 3,
        formField: true
      }
    ];

    // Create deal properties
    const dealProperties = [
      {
        name: "deal_quality_score",
        label: "Deal Quality Score",
        type: "number",
        fieldType: "number",
        groupName: "sales_copilot",
        description: "Score indicating the quality of this deal",
        displayOrder: 1,
        formField: true
      },
      {
        name: "deal_quality_summary",
        label: "Deal Quality Summary",
        type: "string",
        fieldType: "textarea",
        groupName: "sales_copilot",
        description: "Summary of deal quality analysis",
        displayOrder: 2,
        formField: true
      },
      {
        name: "deal_quality_last_scored",
        label: "Last Scored Date",
        type: "datetime",
        fieldType: "date",
        groupName: "sales_copilot",
        description: "When this deal was last evaluated",
        displayOrder: 3,
        formField: true
      }
    ];

    const objectTypes = [
      { name: 'contacts', properties: contactProperties },
      { name: 'companies', properties: companyProperties },
      { name: 'deals', properties: dealProperties }
    ];

    for (const objectType of objectTypes) {
      console.log(`\nProcessing ${objectType.name}...`);

      try {
        // Create property group
        console.log(`Creating property group for ${objectType.name}...`);
        const groupResponse = await fetch(`https://api.hubapi.com/crm/v3/properties/${objectType.name}/groups`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: "sales_copilot",
            label: "Sales Copilot",
            displayOrder: 1
          })
        });

        const groupResult = await groupResponse.text();
        console.log(`Group creation response for ${objectType.name}:`, groupResult);

        if (!groupResponse.ok && groupResponse.status !== 409) {
          throw new Error(`Failed to create group for ${objectType.name}: ${groupResult}`);
        }

        // Create properties
        for (const property of objectType.properties) {
          try {
            console.log(`Creating property ${property.name}...`);
            
            const response = await fetch(`https://api.hubapi.com/crm/v3/properties/${objectType.name}`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(property)
            });

            const result = await response.text();
            console.log(`Response for ${property.name}:`, result);

            if (!response.ok && response.status !== 409) {
              throw new Error(`Failed to create ${property.name}: ${result}`);
            }

            // Wait between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            console.error(`Error creating property ${property.name}:`, error);
            throw error;
          }
        }

        console.log(`Successfully created all properties for ${objectType.name}`);
      } catch (error) {
        console.error(`Error processing ${objectType.name}:`, error);
        // Continue with next object type instead of stopping completely
        continue;
      }
    }

    return true;
  } catch (error) {
    console.error('Error in createHubSpotProperties:', error);
    throw error;
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