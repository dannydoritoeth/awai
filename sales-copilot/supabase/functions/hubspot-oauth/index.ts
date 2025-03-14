import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { encrypt } from '../_shared/encryption.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { HubspotClient } from '../_shared/hubspotClient.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY')!;

async function createHubSpotProperties(accessToken: string) {
  const hubspotClient = new HubspotClient(accessToken);
  
  // Create property groups
  const groups = [
    {
      name: 'sales_copilot_contact',
      label: 'Sales Copilot',
      displayOrder: 1,
      target: 'contact'
    },
    {
      name: 'sales_copilot_company',
      label: 'Sales Copilot',
      displayOrder: 1,
      target: 'company'
    },
    {
      name: 'sales_copilot_deal',
      label: 'Sales Copilot',
      displayOrder: 1,
      target: 'deal'
    }
  ];

  // Create properties for each object type
  const contactProperties = [
    {
      name: 'ideal_client_score',
      label: 'Ideal Client Score',
      type: 'number',
      groupName: 'sales_copilot_contact',
      fieldType: 'number'
    },
    {
      name: 'ideal_client_summary',
      label: 'Ideal Client Summary',
      type: 'string',
      groupName: 'sales_copilot_contact',
      fieldType: 'textarea'
    },
    {
      name: 'ideal_client_last_scored',
      label: 'Last Scored Date',
      type: 'datetime',
      groupName: 'sales_copilot_contact',
      fieldType: 'date'
    }
  ];

  const companyProperties = [
    {
      name: 'company_fit_score',
      label: 'Company Fit Score',
      type: 'number',
      groupName: 'sales_copilot_company',
      fieldType: 'number'
    },
    {
      name: 'company_fit_summary',
      label: 'Company Fit Summary',
      type: 'string',
      groupName: 'sales_copilot_company',
      fieldType: 'textarea'
    },
    {
      name: 'company_fit_last_scored',
      label: 'Last Scored Date',
      type: 'datetime',
      groupName: 'sales_copilot_company',
      fieldType: 'date'
    }
  ];

  const dealProperties = [
    {
      name: 'deal_quality_score',
      label: 'Deal Quality Score',
      type: 'number',
      groupName: 'sales_copilot_deal',
      fieldType: 'number'
    },
    {
      name: 'deal_quality_summary',
      label: 'Deal Quality Summary',
      type: 'string',
      groupName: 'sales_copilot_deal',
      fieldType: 'textarea'
    },
    {
      name: 'deal_quality_last_scored',
      label: 'Last Scored Date',
      type: 'datetime',
      groupName: 'sales_copilot_deal',
      fieldType: 'date'
    }
  ];

  // Create property groups and properties
  for (const group of groups) {
    try {
      await hubspotClient.createPropertyGroup(group);
      console.log(`Created property group: ${group.name}`);
    } catch (error) {
      console.error(`Error creating property group ${group.name}:`, error);
      // Continue even if group creation fails (might already exist)
    }
  }

  // Create properties for each object type
  for (const property of contactProperties) {
    try {
      await hubspotClient.createContactProperty(property);
      console.log(`Created contact property: ${property.name}`);
    } catch (error) {
      console.error(`Error creating contact property ${property.name}:`, error);
    }
  }

  for (const property of companyProperties) {
    try {
      await hubspotClient.createCompanyProperty(property);
      console.log(`Created company property: ${property.name}`);
    } catch (error) {
      console.error(`Error creating company property ${property.name}:`, error);
    }
  }

  for (const property of dealProperties) {
    try {
      await hubspotClient.createDealProperty(property);
      console.log(`Created deal property: ${property.name}`);
    } catch (error) {
      console.error(`Error creating deal property ${property.name}:`, error);
    }
  }
}

async function setupWebhookSubscriptions(accessToken: string, portalId: string) {
  const hubspotClient = new HubspotClient(accessToken);
  const webhookUrl = 'https://rtalhjaoxlcqmxppuhhz.supabase.co/functions/v1/hubspot-webhook';
  
  const subscriptions = [
    { eventType: 'contact.creation' },
    { eventType: 'contact.propertyChange' },
    { eventType: 'company.creation' },
    { eventType: 'company.propertyChange' },
    { eventType: 'deal.creation' },
    { eventType: 'deal.propertyChange' }
  ];

  try {
    for (const subscription of subscriptions) {
      await hubspotClient.createWebhookSubscription(
        portalId,
        '1a625962-e7a0-40e8-a54c-863a24acd1f0', // Your app ID
        {
          ...subscription,
          webhookUrl
        }
      );
      console.log(`Created webhook subscription for ${subscription.eventType}`);
    }
  } catch (error) {
    console.error('Error setting up webhook subscriptions:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    
    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Authorization code required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Exchange the code for tokens
    const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: Deno.env.get('HUBSPOT_CLIENT_ID')!,
        client_secret: Deno.env.get('HUBSPOT_CLIENT_SECRET')!,
        redirect_uri: Deno.env.get('HUBSPOT_REDIRECT_URI')!,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenData);
      return new Response(
        JSON.stringify({ error: 'Failed to exchange authorization code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get HubSpot account info
    const accountResponse = await fetch('https://api.hubapi.com/oauth/v1/access-tokens/' + tokenData.access_token);
    const accountInfo = await accountResponse.json();

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Store the tokens
    const { error: insertError } = await supabase
      .from('hubspot_tokens')
      .upsert({
        portal_id: accountInfo.hub_id.toString(),
        access_token: encrypt(tokenData.access_token, ENCRYPTION_KEY),
        refresh_token: encrypt(tokenData.refresh_token, ENCRYPTION_KEY),
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      });

    if (insertError) {
      console.error('Failed to store tokens:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to store access token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      await createHubSpotProperties(tokenData.access_token);
      console.log('Successfully created HubSpot properties');
      
      await setupWebhookSubscriptions(
        tokenData.access_token,
        accountInfo.hub_id.toString()
      );
      console.log('Successfully set up webhook subscriptions');
    } catch (error) {
      console.error('Setup failed:', error);
      // Continue with success response even if setup fails
      // This allows retry mechanisms to handle it
    }

    return new Response(
      JSON.stringify({ 
        message: "Successfully authenticated and configured app",
        success: true,
        portal_id: accountInfo.hub_id.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('OAuth error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}); 