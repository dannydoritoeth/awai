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