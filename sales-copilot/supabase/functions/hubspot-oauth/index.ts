import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { encrypt } from '../_shared/encryption.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { HubspotClient } from '../_shared/hubspotClient.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY')!;

const trainingProperties = {
  contacts: [
    {
      name: 'training_classification',
      label: 'Training Classification',
      type: 'enumeration',
      fieldType: 'select',
      options: [
        { label: 'Ideal', value: 'ideal' },
        { label: 'Less Ideal', value: 'less_ideal' }
      ],
      groupName: 'ai_scoring'
    },
    {
      name: 'training_score',
      label: 'Training Score',
      type: 'number',
      fieldType: 'number',
      description: 'Score this record from 0-100 to indicate how ideal this contact is',
      groupName: 'ai_scoring'
    },
    {
      name: 'training_attributes',
      label: 'Training Attributes',
      type: 'enumeration',
      fieldType: 'checkbox',
      options: [
        // Positive attributes
        { label: 'High Revenue Potential', value: 'high_revenue' },
        { label: 'Fast Sales Cycle', value: 'fast_sales_cycle' },
        { label: 'Quick Response Time', value: 'quick_response' },
        { label: 'High Engagement', value: 'high_engagement' },
        { label: 'Clear Communication', value: 'clear_communication' },
        { label: 'Industry Fit', value: 'industry_fit' },
        { label: 'Technology Match', value: 'tech_match' },
        { label: 'Growth Potential', value: 'growth_potential' },
        // Negative attributes
        { label: 'Budget Constraints', value: 'budget_constraints' },
        { label: 'Long Sales Cycle', value: 'long_sales_cycle' },
        { label: 'Poor Communication', value: 'poor_communication' },
        { label: 'Low Engagement', value: 'low_engagement' },
        { label: 'Industry Mismatch', value: 'industry_mismatch' },
        { label: 'High Support Needs', value: 'high_support' }
      ],
      groupName: 'ai_scoring'
    },
    {
      name: 'training_notes',
      label: 'Training Notes',
      type: 'string',
      fieldType: 'textarea',
      groupName: 'ai_scoring'
    }
  ],
  companies: [
    {
      name: 'training_classification',
      label: 'Training Classification',
      type: 'enumeration',
      fieldType: 'select',
      options: [
        { label: 'Ideal', value: 'ideal' },
        { label: 'Less Ideal', value: 'less_ideal' }
      ],
      groupName: 'ai_scoring'
    },
    {
      name: 'training_score',
      label: 'Training Score',
      type: 'number',
      fieldType: 'number',
      description: 'Score this record from 0-100 to indicate how ideal this company is',
      groupName: 'ai_scoring'
    },
    {
      name: 'training_attributes',
      label: 'Training Attributes',
      type: 'enumeration',
      fieldType: 'checkbox',
      options: [
        // Positive attributes
        { label: 'Strong Financials', value: 'strong_financials' },
        { label: 'Growth Stage', value: 'growth_stage' },
        { label: 'Market Leader', value: 'market_leader' },
        { label: 'Strong Leadership', value: 'strong_leadership' },
        { label: 'Innovation Focus', value: 'innovation_focus' },
        { label: 'Global Presence', value: 'global_presence' },
        { label: 'Efficient Processes', value: 'efficient_processes' },
        { label: 'Quality Focus', value: 'quality_focus' },
        // Negative attributes
        { label: 'Financial Instability', value: 'financial_instability' },
        { label: 'Limited Resources', value: 'limited_resources' },
        { label: 'Limited Market Share', value: 'limited_market_share' },
        { label: 'Process Issues', value: 'process_issues' },
        { label: 'Technology Gaps', value: 'tech_gaps' },
        { label: 'Geographic Limitations', value: 'geographic_limitations' }
      ],
      groupName: 'ai_scoring'
    },
    {
      name: 'training_notes',
      label: 'Training Notes',
      type: 'string',
      fieldType: 'textarea',
      groupName: 'ai_scoring'
    }
  ]
};

async function createHubSpotProperties(accessToken: string) {
  const hubspotClient = new HubspotClient(accessToken);
  let contactGroupCreated = false;
  let companyGroupCreated = false;

  // Create property groups first
  try {
    await hubspotClient.createPropertyGroup({
      name: 'ai_scoring',
      label: 'AI Scoring',
      displayOrder: 1,
      target: 'contact'
    });
    console.log('Created contact property group: ai_scoring');
    contactGroupCreated = true;
  } catch (error) {
    console.error('Error creating contact property group:', error);
  }

  try {
    await hubspotClient.createPropertyGroup({
      name: 'ai_scoring',
      label: 'AI Scoring',
      displayOrder: 1,
      target: 'company'
    });
    console.log('Created company property group: ai_scoring');
    companyGroupCreated = true;
  } catch (error) {
    console.error('Error creating company property group:', error);
  }

  // Add a small delay to ensure HubSpot has processed the groups
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Only create contact properties if the group was created
  if (contactGroupCreated) {
    for (const property of trainingProperties.contacts) {
      try {
        await hubspotClient.createContactProperty(property);
        console.log(`Created contact property: ${property.name}`);
      } catch (error) {
        console.error(`Error creating contact property ${property.name}:`, error);
      }
    }
  } else {
    console.log('Skipping contact properties as group creation failed');
  }

  // Only create company properties if the group was created
  if (companyGroupCreated) {
    for (const property of trainingProperties.companies) {
      try {
        await hubspotClient.createCompanyProperty(property);
        console.log(`Created company property: ${property.name}`);
      } catch (error) {
        console.error(`Error creating company property ${property.name}:`, error);
      }
    }
  } else {
    console.log('Skipping company properties as group creation failed');
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

    console.log('Token data received:', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      tokenType: tokenData.token_type
    });

    // Get HubSpot account info
    const accountResponse = await fetch('https://api.hubapi.com/oauth/v1/access-tokens/' + tokenData.access_token);
    const accountInfo = await accountResponse.json();

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Store the tokens
    const { error } = await supabase
      .from('hubspot_accounts')
      .upsert({
        portal_id: accountInfo.hub_id.toString(),
        access_token: await encrypt(tokenData.access_token, ENCRYPTION_KEY),
        refresh_token: await encrypt(tokenData.refresh_token, ENCRYPTION_KEY),
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        token_type: tokenData.token_type || 'bearer',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: JSON.stringify({
          user_id: accountInfo.user_id,
          hub_domain: accountInfo.hub_domain,
          scopes: tokenData.scope?.split(' ') || []
        })
      });

    if (error) {
      console.error('Failed to store tokens:', error);
      console.error('Token storage payload:', {
        portalId: accountInfo.hub_id.toString(),
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        tokenType: tokenData.token_type || 'bearer'
      });
      return new Response(
        JSON.stringify({ error: 'Failed to store access token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      await createHubSpotProperties(tokenData.access_token);
      console.log('Successfully created HubSpot properties');
      
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