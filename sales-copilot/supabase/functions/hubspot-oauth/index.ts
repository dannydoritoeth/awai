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
  ],
  deals: [
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
      name: 'company_fit_score',
      label: 'Company Fit Score',
      type: 'number',
      fieldType: 'number',
      description: 'AI-generated score indicating how well this company matches your ideal customer profile',
      groupName: 'ai_scoring'
    },
    {
      name: 'company_fit_summary',
      label: 'Company Fit Summary',
      type: 'string',
      fieldType: 'textarea',
      description: 'AI-generated analysis of why this company matches or differs from your ideal customer profile',
      groupName: 'ai_scoring'
    },
    {
      name: 'company_fit_last_scored',
      label: 'Last Scored',
      type: 'datetime',
      fieldType: 'date',
      description: 'When this company was last analyzed by AI',
      groupName: 'ai_scoring'
    }
  ],
  deals: [
    {
      name: 'deal_quality_score',
      label: 'Deal Quality Score',
      type: 'number',
      fieldType: 'number',
      description: 'AI-generated score indicating the overall quality and likelihood of closing this deal',
      groupName: 'ai_scoring'
    },
    {
      name: 'deal_quality_summary',
      label: 'Deal Quality Summary',
      type: 'string',
      fieldType: 'textarea',
      description: 'AI-generated analysis of deal quality factors and recommendations',
      groupName: 'ai_scoring'
    },
    {
      name: 'deal_quality_last_scored',
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

  // Create CRM cards for contacts and companies
  try {
    await hubspotClient.createCrmCard(
      Deno.env.get('HUBSPOT_APP_ID')!,
      {
        title: 'AI Scoring',
        objectType: 'contacts',
        properties: [
          // Training properties
          'training_classification',
          'training_score',
          'training_attributes',
          'training_notes',
          // Scoring properties
          'ideal_client_score',
          'ideal_client_summary',
          'ideal_client_last_scored'
        ]
      }
    );
    console.log('Created contact CRM card');
  } catch (error) {
    console.error('Error creating contact CRM card:', error);
  }

  try {
    await hubspotClient.createCrmCard(
      Deno.env.get('HUBSPOT_APP_ID')!,
      {
        title: 'AI Scoring',
        objectType: 'companies',
        properties: [
          // Training properties
          'training_classification',
          'training_score',
          'training_attributes',
          'training_notes',
          // Scoring properties
          'company_fit_score',
          'company_fit_summary',
          'company_fit_last_scored'
        ]
      }
    );
    console.log('Created company CRM card');
  } catch (error) {
    console.error('Error creating company CRM card:', error);
  }

  try {
    await hubspotClient.createCrmCard(
      Deno.env.get('HUBSPOT_APP_ID')!,
      {
        title: 'AI Scoring',
        objectType: 'deals',
        properties: [
          // Training properties
          'training_classification',
          'training_score',
          'training_attributes',
          'training_notes',
          // Scoring properties
          'deal_quality_score',
          'deal_quality_summary',
          'deal_quality_last_scored'
        ]
      }
    );
    console.log('Created deal CRM card');
  } catch (error) {
    console.error('Error creating deal CRM card:', error);
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