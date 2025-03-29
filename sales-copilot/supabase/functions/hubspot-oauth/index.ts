import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { encrypt } from '../_shared/encryption.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { HubspotClient } from '../_shared/hubspotClient.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY')!;
const HUBSPOT_CLIENT_ID = Deno.env.get('HUBSPOT_CLIENT_ID')!;
const HUBSPOT_CLIENT_SECRET = Deno.env.get('HUBSPOT_CLIENT_SECRET')!;
const HUBSPOT_REDIRECT_URI = Deno.env.get('HUBSPOT_REDIRECT_URI')!;
const APP_INSTALL_SUCCESS_URI = Deno.env.get('APP_INSTALL_SUCCESS_URI')!;
const APP_INSTALL_FAILED_URI = Deno.env.get('APP_INSTALL_FAILED_URI')!;

const trainingProperties = {
  contacts: [
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
  ],
  deals: [
    {
      name: 'training_score',
      label: 'Training Score',
      type: 'number',
      fieldType: 'number',
      description: 'Score this record from 0-100 to indicate how ideal this deal is',
      groupName: 'ai_scoring'
    },
    {
      name: 'training_attributes',
      label: 'Training Attributes',
      type: 'enumeration',
      fieldType: 'checkbox',
      options: [
        // Positive attributes
        { label: 'High Value', value: 'high_value' },
        { label: 'Quick Close', value: 'quick_close' },
        { label: 'Clear Requirements', value: 'clear_requirements' },
        { label: 'Strong Champion', value: 'strong_champion' },
        { label: 'Budget Approved', value: 'budget_approved' },
        { label: 'Strategic Fit', value: 'strategic_fit' },
        { label: 'Competitive Advantage', value: 'competitive_advantage' },
        // Negative attributes
        { label: 'Low Value', value: 'low_value' },
        { label: 'Long Sales Cycle', value: 'long_sales_cycle' },
        { label: 'Unclear Requirements', value: 'unclear_requirements' },
        { label: 'No Champion', value: 'no_champion' },
        { label: 'Budget Issues', value: 'budget_issues' },
        { label: 'High Competition', value: 'high_competition' }
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

const scoringProperties = {
  contacts: [
    {
      name: 'ideal_client_score',
      label: 'Ideal Client Score',
      type: 'number',
      fieldType: 'number',
      description: 'AI-generated score indicating how well this contact matches your ideal client profile',
      groupName: 'ai_scoring'
    },
    {
      name: 'ideal_client_summary',
      label: 'Ideal Client Summary',
      type: 'string',
      fieldType: 'textarea',
      description: 'AI-generated analysis of why this contact matches or differs from your ideal client profile',
      groupName: 'ai_scoring'
    },
    {
      name: 'ideal_client_last_scored',
      label: 'Last Scored',
      type: 'datetime',
      fieldType: 'date',
      description: 'When this contact was last analyzed by AI',
      groupName: 'ai_scoring'
    }
  ],
  companies: [
    {
      name: 'ideal_client_score',
      label: 'Ideal Client Score',
      type: 'number',
      fieldType: 'number',
      description: 'AI-generated score indicating how well this company matches your ideal client profile',
      groupName: 'ai_scoring'
    },
    {
      name: 'ideal_client_summary',
      label: 'Ideal Client Summary',
      type: 'string',
      fieldType: 'textarea',
      description: 'AI-generated analysis of why this company matches or differs from your ideal client profile',
      groupName: 'ai_scoring'
    },
    {
      name: 'ideal_client_last_scored',
      label: 'Last Scored',
      type: 'datetime',
      fieldType: 'date',
      description: 'When this company was last analyzed by AI',
      groupName: 'ai_scoring'
    }
  ],
  deals: [
    {
      name: 'ideal_client_score',
      label: 'Ideal Client Score',
      type: 'number',
      fieldType: 'number',
      description: 'AI-generated score indicating how well this deal matches your ideal client profile',
      groupName: 'ai_scoring'
    },
    {
      name: 'ideal_client_summary',
      label: 'Ideal Client Summary',
      type: 'string',
      fieldType: 'textarea',
      description: 'AI-generated analysis of why this deal matches or differs from your ideal client profile',
      groupName: 'ai_scoring'
    },
    {
      name: 'ideal_client_last_scored',
      label: 'Last Scored',
      type: 'datetime',
      fieldType: 'date',
      description: 'When this deal was last analyzed by AI',
      groupName: 'ai_scoring'
    }
  ]
};

async function createHubSpotProperties(accessToken: string) {
  const hubspotClient = new HubspotClient(accessToken);
  let contactGroupCreated = false;
  let companyGroupCreated = false;
  let dealGroupCreated = false;

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

  try {
    await hubspotClient.createPropertyGroup({
      name: 'ai_scoring',
      label: 'AI Scoring',
      displayOrder: 1,
      target: 'deal'
    });
    console.log('Created deal property group: ai_scoring');
    dealGroupCreated = true;
  } catch (error) {
    console.error('Error creating deal property group:', error);
  }

  // Add a small delay to ensure HubSpot has processed the groups
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Only create contact properties if the group was created
  if (contactGroupCreated) {
    // Create training properties
    for (const property of trainingProperties.contacts) {
      try {
        await hubspotClient.createContactProperty(property);
        console.log(`Created contact training property: ${property.name}`);
      } catch (error) {
        console.error(`Error creating contact training property ${property.name}:`, error);
      }
    }
    // Create scoring properties
    for (const property of scoringProperties.contacts) {
      try {
        await hubspotClient.createContactProperty(property);
        console.log(`Created contact scoring property: ${property.name}`);
      } catch (error) {
        console.error(`Error creating contact scoring property ${property.name}:`, error);
      }
    }
  } else {
    console.log('Skipping contact properties as group creation failed');
  }

  // Only create company properties if the group was created
  if (companyGroupCreated) {
    // Create training properties
    for (const property of trainingProperties.companies) {
      try {
        await hubspotClient.createCompanyProperty(property);
        console.log(`Created company training property: ${property.name}`);
      } catch (error) {
        console.error(`Error creating company training property ${property.name}:`, error);
      }
    }
    // Create scoring properties
    for (const property of scoringProperties.companies) {
      try {
        await hubspotClient.createCompanyProperty(property);
        console.log(`Created company scoring property: ${property.name}`);
      } catch (error) {
        console.error(`Error creating company scoring property ${property.name}:`, error);
      }
    }
  } else {
    console.log('Skipping company properties as group creation failed');
  }

  // Only create deal properties if the group was created
  if (dealGroupCreated) {
    // Create training properties
    for (const property of trainingProperties.deals) {
      try {
        await hubspotClient.createDealProperty(property);
        console.log(`Created deal training property: ${property.name}`);
      } catch (error) {
        console.error(`Error creating deal training property ${property.name}:`, error);
      }
    }
    // Create scoring properties
    for (const property of scoringProperties.deals) {
      try {
        await hubspotClient.createDealProperty(property);
        console.log(`Created deal scoring property: ${property.name}`);
      } catch (error) {
        console.error(`Error creating deal scoring property ${property.name}:`, error);
      }
    }
  } else {
    console.log('Skipping deal properties as group creation failed');
  }
}

async function exchangeCodeForToken(code: string): Promise<{ access_token: string; refresh_token: string; hub_id: number }> {
  const tokenEndpoint = 'https://api.hubapi.com/oauth/v1/token';
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: HUBSPOT_CLIENT_ID,
    client_secret: HUBSPOT_CLIENT_SECRET,
    redirect_uri: HUBSPOT_REDIRECT_URI,
    code: code
  });

  console.log('Exchanging code for token...');
  
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Token exchange failed:', error);
    throw new Error(`Failed to exchange code for token: ${error}`);
  }

  const data = await response.json();
  console.log('Token response data:', JSON.stringify(data, null, 2));

  if (!data.access_token) {
    console.error('No access token in response');
    throw new Error('No access token in response');
  }

  if (!data.refresh_token) {
    console.error('No refresh token in response');
    throw new Error('No refresh token in response');
  }

  // Fetch token metadata to get hub ID
  console.log('Fetching token metadata...');
  const metadataResponse = await fetch(`https://api.hubapi.com/oauth/v1/access-tokens/${data.access_token}`, {
    method: 'GET'
  });

  if (!metadataResponse.ok) {
    const error = await metadataResponse.text();
    console.error('Token metadata fetch failed:', error);
    throw new Error(`Failed to fetch token metadata: ${error}`);
  }

  const metadata = await metadataResponse.json();
  console.log('Token metadata:', JSON.stringify(metadata, null, 2));

  const hubId = metadata.hub_id;
  if (!hubId) {
    console.error('No hub_id in token metadata');
    throw new Error('Failed to get hub ID from token metadata');
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    hub_id: Number(hubId)
  };
}

async function handleOAuth(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  
  if (!code) {
    const failureUri = new URL(APP_INSTALL_FAILED_URI);
    failureUri.searchParams.set('error', 'Missing authorization code');
    return Response.redirect(failureUri.toString(), 302);
  }

  try {
    // Exchange the code for tokens
    const { access_token, refresh_token, hub_id } = await exchangeCodeForToken(code);
    console.log('Successfully exchanged code for tokens');

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Encrypt the tokens before storing
    const encryptedAccessToken = await encrypt(access_token, ENCRYPTION_KEY);
    const encryptedRefreshToken = await encrypt(refresh_token, ENCRYPTION_KEY);

    const now = new Date().toISOString();

    // Store the HubSpot account information
    const { data: accountData, error: accountError } = await supabase
      .from('hubspot_accounts')
      .upsert({
        portal_id: hub_id.toString(),
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        expires_at: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: now,
        updated_at: now,
        status: 'active',
        token_type: 'bearer',
        metadata: {},
        ai_provider: 'openai',
        ai_model: 'gpt-4-turbo-preview',
        ai_temperature: 0.7,
        ai_max_tokens: 4000,
        last_scoring_counts: { contacts: 0, companies: 0, deals: 0 }
      }, {
        onConflict: 'portal_id'
      })
      .select();

    if (accountError) {
      console.error('Failed to store HubSpot account:', accountError);
      const failureUri = new URL(APP_INSTALL_FAILED_URI);
      failureUri.searchParams.set('error', 'Failed to store HubSpot account information');
      return Response.redirect(failureUri.toString(), 302);
    }

    console.log('Successfully stored HubSpot account information');

    let setupError = null;
    try {
      await createHubSpotProperties(access_token);
      console.log('Successfully created HubSpot properties');
    } catch (error) {
      console.error('Setup failed:', error);
      setupError = error instanceof Error ? error.message : 'Property setup failed';
    }

    // Validate required properties
    try {
      const hubspotClient = new HubspotClient(access_token);
      await hubspotClient.validateProperties();
      console.log('Successfully validated HubSpot properties');
    } catch (error) {
      console.error('Property validation failed:', error);
      if (!setupError) {
        setupError = error instanceof Error ? error.message : 'Property validation failed';
      }
    }

    // Redirect to success URI with portal ID and any setup warnings
    const successUri = new URL(APP_INSTALL_SUCCESS_URI);
    successUri.searchParams.set('portal_id', hub_id.toString());
    if (setupError) {
      successUri.searchParams.set('warning', setupError);
    }
    return Response.redirect(successUri.toString(), 302);

  } catch (error) {
    console.error('OAuth process failed:', error);
    const failureUri = new URL(APP_INSTALL_FAILED_URI);
    failureUri.searchParams.set('error', error instanceof Error ? error.message : 'Failed to complete OAuth process');
    return Response.redirect(failureUri.toString(), 302);
  }
}

serve(handleOAuth);