/// <reference types="deno" />
/// <reference lib="deno.window" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { Pinecone } from 'https://esm.sh/@pinecone-database/pinecone@5.1.1';
import OpenAI from 'https://esm.sh/openai@4.86.1';
import { HubspotClient, HubspotRecord } from '../_shared/hubspotClient.ts';
import { Logger } from '../_shared/logger.ts';
import { decrypt, encrypt } from '../_shared/encryption.ts';
import { DocumentPackager } from '../_shared/documentPackager.ts';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const logger = new Logger('hubspot-auto-training');

interface DealCriteria {
  dealstage: string;
  amount?: number;
  closedate?: string;
  createdate: string;
}

interface DealMetadata {
  deal_id: string;
  deal_value: number;
  conversion_days: number;
  pipeline: string;
  dealstage: string;
  won_date?: string;
  lost_date?: string;
  related_contacts: string[];
  related_companies: string[];
  days_in_pipeline: number;
  stage_changes: number;
}

interface ContactMetadata {
  contact_id: string;
  lifecycle_stage: string;
  lead_source: string;
  total_deals_participated: number;
  total_won_deals: number;
  total_lost_deals: number;
  first_conversion_date?: string;
  last_activity_date?: string;
  engagement_score: number;
  deal_participation_rate: number;
  industry?: string;
  company_size?: string;
}

interface CompanyMetadata {
  company_id: string;
  industry?: string;
  company_size?: string;
  total_revenue?: number;
  country?: string;
  city?: string;
  total_deals: number;
  won_deals: number;
  lost_deals: number;
  average_deal_size: number;
  average_sales_cycle: number;
  engagement_score: number;
  first_deal_date?: string;
  last_deal_date?: string;
}

interface SearchFilter {
  propertyName: string;
  operator: string;
  value?: string;
  values?: string[];
}

interface SearchSort {
  propertyName: string;
  direction: 'ASCENDING' | 'DESCENDING';
}

interface SearchRequest {
  filterGroups: Array<{
    filters: SearchFilter[];
  }>;
  properties?: string[];
  limit?: number;
  after?: string;
  sorts?: SearchSort[];
}

function calculateConversionDays(properties: DealCriteria): number {
  const createDate = new Date(properties.createdate);
  const closeDate = properties.closedate ? new Date(properties.closedate) : null;
  
  if (!closeDate) return 0;
  
  return Math.ceil((closeDate.getTime() - createDate.getTime()) / (1000 * 60 * 60 * 24));
}

async function getDealsForTraining(hubspotClient: HubspotClient, type: 'ideal' | 'nonideal'): Promise<any[]> {
  try {
    const ninety_days_ago = new Date();
    ninety_days_ago.setDate(ninety_days_ago.getDate() - 90);
    const allDeals: any[] = [];
    let hasMore = true;
    let after: string | null = null;

    while (hasMore) {
      const searchCriteria = {
        filterGroups: [{
          filters: [
            {
              propertyName: 'createdate',
              operator: 'LTE',
              value: ninety_days_ago.getTime().toString()
            },
            {
              propertyName: 'dealstage',
              operator: 'EQ',
              value: type === 'ideal' ? 'closedwon' : 'closedlost'
            }
          ]
        }],
        sorts: [
          {
            propertyName: 'amount',
            direction: 'DESCENDING'
          }
        ],
        properties: [
          'dealname',
          'amount',
          'closedate',
          'createdate',
          'dealstage',
          'pipeline',
          'hs_lastmodifieddate',
          'hs_date_entered_closedwon',
          'hs_date_entered_closedlost'
        ],
        limit: 100,
        ...(after ? { after } : {})
      };

      logger.info(`Searching for ${type} deals with criteria:`, JSON.stringify(searchCriteria, null, 2));
      const deals = await hubspotClient.searchRecords('deals', searchCriteria);
      logger.info(`Found ${deals.total || 0} total ${type} deals, fetched ${deals.results?.length || 0} in this batch`);
      
      if (deals.results?.length) {
        allDeals.push(...deals.results);
      }

      hasMore = deals.paging?.next?.after !== undefined;
      after = deals.paging?.next?.after || null;

      if (hasMore) {
        logger.info(`More deals available, continuing with after=${after}`);
      }
    }

    logger.info(`Total ${type} deals collected: ${allDeals.length}`);
    
    // Get full deal details with associations
    const fullDeals = await Promise.all(
      allDeals.map(async (deal) => {
        try {
          return await hubspotClient.getRecord('deals', deal.id, [
            'dealname',
            'amount',
            'closedate',
            'createdate',
            'dealstage',
            'pipeline',
            'hs_lastmodifieddate',
            'hs_date_entered_closedwon',
            'hs_date_entered_closedlost',
            'hs_deal_stage_probability',
            'hs_pipeline_stage',
            'hs_time_in_pipeline',
            'hs_time_in_dealstage',
            'hs_deal_stage_changes'
          ]);
        } catch (error) {
          logger.error(`Error fetching full deal details for ${deal.id}:`, error);
          return null;
        }
      })
    );

    return fullDeals.filter(deal => deal !== null);
  } catch (error) {
    logger.error(`Error fetching ${type} deals:`, error);
    throw error;
  }
}

async function getAssociatedRecords(hubspotClient: HubspotClient, deal: any) {
  const contacts: HubspotRecord[] = [];
  const companies: HubspotRecord[] = [];

  try {
    // Get associated contacts with specific properties
    if (deal.associations?.contacts?.results?.length > 0) {
      logger.info(`Fetching ${deal.associations.contacts.results.length} associated contacts for deal ${deal.id}`);
      
      for (const contact of deal.associations.contacts.results) {
        try {
          const contactData = await hubspotClient.getContact(contact.id);
          if (contactData) {
            contacts.push(contactData);
          }
        } catch (error) {
          logger.error(`Error fetching contact ${contact.id}:`, error);
          // Continue with other contacts even if one fails
        }
      }
    }

    // Get associated companies with specific properties
    if (deal.associations?.companies?.results?.length > 0) {
      logger.info(`Fetching ${deal.associations.companies.results.length} associated companies for deal ${deal.id}`);
      
      for (const company of deal.associations.companies.results) {
        try {
          const companyData = await hubspotClient.getCompany(company.id);
          if (companyData) {
            companies.push(companyData);
          }
        } catch (error) {
          logger.error(`Error fetching company ${company.id}:`, error);
          // Continue with other companies even if one fails
        }
      }
    }

    logger.info(`Successfully fetched ${contacts.length} contacts and ${companies.length} companies for deal ${deal.id}`);
    return { contacts, companies };
  } catch (error) {
    logger.error(`Error fetching associated records for deal ${deal.id}:`, error);
    // Return what we have so far rather than failing completely
    return { contacts, companies };
  }
}

function calculateDealMetrics(deal: any, contacts: any[], companies: any[]): DealMetadata {
  const createDate = new Date(deal.properties.createdate);
  const closeDate = deal.properties.closedate ? new Date(deal.properties.closedate) : null;
  const daysInPipeline = deal.properties.hs_time_in_pipeline ? 
    parseInt(deal.properties.hs_time_in_pipeline) : 
    (closeDate ? Math.ceil((closeDate.getTime() - createDate.getTime()) / (1000 * 60 * 60 * 24)) : 0);

  return {
    deal_id: deal.id,
    deal_value: parseFloat(deal.properties.amount) || 0,
    conversion_days: calculateConversionDays(deal.properties),
    pipeline: deal.properties.pipeline || 'default',
    dealstage: deal.properties.dealstage,
    won_date: deal.properties.hs_date_entered_closedwon || '',
    lost_date: deal.properties.hs_date_entered_closedlost || '',
    related_contacts: contacts.map(c => c.id),
    related_companies: companies.map(c => c.id),
    days_in_pipeline: daysInPipeline,
    stage_changes: parseInt(deal.properties.hs_deal_stage_changes) || 0
  };
}

function calculateContactMetrics(contact: any, dealHistory: any[]): ContactMetadata {
  const wonDeals = dealHistory.filter(d => d.properties.dealstage === 'closedwon').length;
  const lostDeals = dealHistory.filter(d => d.properties.dealstage === 'closedlost').length;
  
  return {
    contact_id: contact.id,
    lifecycle_stage: contact.properties.lifecyclestage || 'unknown',
    lead_source: contact.properties.lead_source || 'unknown',
    total_deals_participated: dealHistory.length,
    total_won_deals: wonDeals,
    total_lost_deals: lostDeals,
    first_conversion_date: contact.properties.first_conversion_date || '',
    last_activity_date: contact.properties.last_activity_date || '',
    engagement_score: parseFloat(contact.properties.hs_email_engagement) || 0,
    deal_participation_rate: dealHistory.length > 0 ? wonDeals / dealHistory.length : 0,
    industry: contact.properties.industry || '',
    company_size: contact.properties.numemployees || ''
  };
}

function calculateCompanyMetrics(company: any): CompanyMetadata {
  return {
    company_id: company.id,
    industry: company.properties.industry || '',
    company_size: company.properties.numberofemployees || '',
    total_revenue: parseFloat(company.properties.total_revenue) || 0,
    country: company.properties.country || '',
    city: company.properties.city || '',
    total_deals: parseInt(company.properties.total_deals) || 0,
    won_deals: parseInt(company.properties.closed_won_deals) || 0,
    lost_deals: parseInt(company.properties.closed_lost_deals) || 0,
    average_deal_size: parseFloat(company.properties.avg_deal_value) || 0,
    average_sales_cycle: parseFloat(company.properties.avg_sales_cycle) || 0,
    engagement_score: parseFloat(company.properties.engagement_score) || 0,
    first_deal_date: company.properties.first_deal_created_date || '',
    last_deal_date: company.properties.recent_deal_close_date || ''
  };
}

async function createDocuments(documentPackager: DocumentPackager, records: any[], type: 'deal' | 'contact' | 'company', portalId: string, classification: 'ideal' | 'nonideal', dealMetadata: any) {
  return Promise.all(
    records.map(async (record) => {
      const doc = await documentPackager.packageDocument(record, type, portalId);
      
      // Calculate specific metadata based on record type
      let specificMetadata = {};
      if (type === 'deal') {
        specificMetadata = calculateDealMetrics(record, [], []); // Empty arrays since we don't need recursive metadata
      } else if (type === 'contact') {
        specificMetadata = calculateContactMetrics(record, [dealMetadata]); // Pass the parent deal
      } else if (type === 'company') {
        specificMetadata = calculateCompanyMetrics(record);
      }

      // Create a unique document ID using recordType-recordId format
      const documentId = `${type}-${record.id}`;

      return {
        id: documentId, // Add explicit id field
        ...doc,
        metadata: {
          ...doc.metadata,
          ...specificMetadata,
          classification,
          source: 'auto-train',
          record_type: type,
          deal_id: dealMetadata.deal_id,
          deal_value: dealMetadata.deal_value,
          conversion_days: dealMetadata.conversion_days
        }
      };
    })
  );
}

async function refreshHubSpotToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: Deno.env.get('HUBSPOT_CLIENT_ID')!,
      client_secret: Deno.env.get('HUBSPOT_CLIENT_SECRET')!,
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('Failed to refresh token:', error);
    throw new Error('Failed to refresh HubSpot token');
  }

  return response.json();
}

async function validateAndRefreshTokenIfNeeded(
  hubspotClient: HubspotClient, 
  portalId: string, 
  currentToken: string,
  refreshToken: string
): Promise<string> {
  try {
    logger.info(`[Token Validation] Starting token validation for portal ${portalId}`);
    logger.info('[Token Validation] Making test request to HubSpot API');

    // Try to make a test request to validate the token
    try {
      await hubspotClient.searchRecords('contacts', { limit: 1 });
      logger.info('[Token Validation] Token is valid');
      return currentToken;
    } catch (error) {
      if (error.message.includes('401') || error.message.includes('expired')) {
        logger.info(`[Token Validation] Token expired for portal ${portalId}, attempting refresh`);
        
        try {
          const newTokens = await refreshHubSpotToken(refreshToken);
          logger.info('[Token Validation] Successfully obtained new tokens');
          
          // Update tokens in database
          logger.info('[Token Validation] Updating tokens in database');
          const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );

          const newEncryptedToken = await encrypt(newTokens.access_token, Deno.env.get('ENCRYPTION_KEY')!);
          const newEncryptedRefreshToken = await encrypt(newTokens.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);
          
          const { error: updateError } = await supabase
            .from('hubspot_accounts')
            .update({
              access_token: newEncryptedToken,
              refresh_token: newEncryptedRefreshToken,
              expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('portal_id', portalId);
            
          if (updateError) {
            logger.error('[Token Validation] Failed to update tokens in database:', updateError);
            throw new Error('Failed to update HubSpot tokens');
          }
          
          // Update the client with the new token
          hubspotClient.updateToken(newTokens.access_token);
          logger.info('[Token Validation] Successfully updated tokens in database');
          return newTokens.access_token;
        } catch (refreshError) {
          logger.error('[Token Validation] Error during token refresh:', {
            message: refreshError.message,
            stack: refreshError.stack,
            details: refreshError
          });
          throw refreshError;
        }
      }
      
      logger.error('[Token Validation] Unhandled error:', {
        message: error.message,
        stack: error.stack,
        details: error
      });
      throw error;
    }
  } catch (error) {
    logger.error(`[Token Validation] Fatal error for portal ${portalId}:`, {
      message: error.message,
      stack: error.stack,
      details: error
    });
    throw error;
  }
}

async function processDeals(
  deals: any[], 
  classification: 'ideal' | 'nonideal',
  hubspotClient: HubspotClient,
  documentPackager: DocumentPackager,
  openai: OpenAI,
  index: any,
  portalId: string
) {
  logger.info(`Starting to process ${deals.length} ${classification} deals`);
  for (const deal of deals) {
    try {
      logger.info(`Processing ${classification} deal ${deal.id} (${deal.properties?.dealname || 'Unnamed Deal'})`);

      // Get associated records
      logger.info(`Fetching associated records for deal ${deal.id}`);
      const { contacts, companies } = await getAssociatedRecords(hubspotClient, deal);
      logger.info(`Found ${contacts.length} contacts and ${companies.length} companies for deal ${deal.id}`);

      // Calculate deal metrics
      logger.info(`Calculating metrics for deal ${deal.id}`);
      const dealMetadata = calculateDealMetrics(deal, contacts, companies);
      logger.info(`Deal metrics calculated for ${deal.id}`);

      // Create documents
      logger.info(`Creating documents for deal ${deal.id} and associated records`);
      const documents = await Promise.all([
        ...await createDocuments(documentPackager, [deal], 'deal', portalId, classification, dealMetadata),
        ...await createDocuments(documentPackager, contacts, 'contact', portalId, classification, dealMetadata),
        ...await createDocuments(documentPackager, companies, 'company', portalId, classification, dealMetadata)
      ]);
      logger.info(`Created ${documents.length} documents for deal ${deal.id}`);

      // Get embeddings for all documents
      logger.info(`Getting embeddings for ${documents.length} documents`);
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: documents.map(doc => doc.content)
      });
      logger.info('Received embeddings from OpenAI');

      // Prepare vectors with embeddings
      const vectors = documents.map((doc, index) => ({
        id: doc.id,
        values: Array.from(embeddingResponse.data[index].embedding),
        metadata: doc.metadata
      }));
      logger.info('Prepared vectors for upsert:', vectors.map(v => ({ id: v.id, type: v.metadata.record_type })));

      // Upsert to Pinecone
      await index.upsert(vectors);
      logger.info(`Successfully upserted documents for deal ${deal.id}`);

      logger.info(`Successfully processed ${classification} deal ${deal.id}`);
    } catch (error) {
      logger.error(`Error processing ${classification} deal ${deal.id}:`, {
        error: error.message,
        stack: error.stack,
        details: error
      });
      // Continue with other deals even if one fails
    }
  }
  logger.info(`Completed processing all ${classification} deals`);
}

serve(async (req) => {
  try {
    logger.info('=== Starting auto-training function ===');
    
    if (req.method === "OPTIONS") {
      logger.info('Handling CORS preflight request');
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    if (req.method !== "POST") {
      logger.info(`Invalid method: ${req.method}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Method ${req.method} not allowed`
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 405
        }
      );
    }

    logger.info('Step 1: Initializing Supabase client');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    logger.info('Step 2: Fetching active HubSpot accounts');
    const { data: accounts, error: accountsError } = await supabase
      .from('hubspot_accounts')
      .select('*')
      .eq('status', 'active');

    if (accountsError) {
      logger.error('Error fetching accounts:', accountsError);
      throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
    }

    if (!accounts || accounts.length === 0) {
      logger.info('No active accounts found');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No active HubSpot accounts found'
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 404
        }
      );
    }

    logger.info(`Found ${accounts.length} active accounts to process`);

    const results = await Promise.all(
      accounts.map(async (account) => {
        try {
          logger.info(`\n=== Processing portal ${account.portal_id} ===`);
          
          logger.info('Step 3: Decrypting tokens');
          const decryptedToken = await decrypt(account.access_token, Deno.env.get('ENCRYPTION_KEY')!);
          const decryptedRefreshToken = await decrypt(account.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);

          if (!decryptedToken || !decryptedRefreshToken) {
            logger.error(`Invalid tokens for portal ${account.portal_id}`);
            throw new Error('Invalid tokens');
          }

          logger.info('Step 4: Initializing HubSpot client');
          const hubspotClient = new HubspotClient(decryptedToken);
          
          logger.info('Step 5: Validating and refreshing token if needed');
          const validToken = await validateAndRefreshTokenIfNeeded(
            hubspotClient,
            account.portal_id,
            decryptedToken,
            decryptedRefreshToken
          );

          if (validToken !== decryptedToken) {
            logger.info('Token was refreshed successfully');
          } else {
            logger.info('Token is still valid');
          }

          try {
            // Initialize OpenAI and Pinecone clients
            logger.info('Step 6: Initializing AI services');
            logger.info('Initializing OpenAI client...');
            const openai = new OpenAI({
              apiKey: Deno.env.get('OPENAI_API_KEY')!
            });
            logger.info('OpenAI client initialized');

            logger.info('Initializing Pinecone client...');
            const pinecone = new Pinecone({
              apiKey: Deno.env.get('PINECONE_API_KEY')!,
              // Optional parameters if needed:
              // controllerHostUrl: 'https://your-controller-url',
              // maxRetries: 3
            });
            logger.info('Pinecone client initialized');

            const index = pinecone.index(Deno.env.get('PINECONE_INDEX')!);
            logger.info('Pinecone index accessed');

            logger.info('Initializing DocumentPackager...');
            const documentPackager = new DocumentPackager(openai);
            logger.info('DocumentPackager initialized');

            // Process ideal and non-ideal deals
            logger.info('Step 7: Fetching deals for training');
            logger.info('Fetching ideal deals...');
            const idealDeals = await getDealsForTraining(hubspotClient, 'ideal');
            logger.info('Fetching non-ideal deals...');
            const nonIdealDeals = await getDealsForTraining(hubspotClient, 'nonideal');

            logger.info(`Found ${idealDeals.length} ideal deals and ${nonIdealDeals.length} non-ideal deals`);

            // Process both deal types
            logger.info('Starting parallel processing of ideal and non-ideal deals');
            await Promise.all([
              processDeals(idealDeals, 'ideal', hubspotClient, documentPackager, openai, index, account.portal_id),
              processDeals(nonIdealDeals, 'nonideal', hubspotClient, documentPackager, openai, index, account.portal_id)
            ]);
            logger.info('Completed processing all deals');

            logger.info(`=== Completed processing portal ${account.portal_id} ===\n`);
            return {
              portal_id: account.portal_id,
              status: 'success',
              token_refreshed: validToken !== decryptedToken,
              deals_processed: {
                ideal: idealDeals.length,
                nonideal: nonIdealDeals.length
              }
            };
          } catch (error) {
            logger.error(`Error processing portal ${account.portal_id}:`, {
              error: error.message,
              stack: error.stack,
              status: error.status,
              details: error
            });
            return {
              portal_id: account.portal_id,
              status: 'error',
              error: error.message
            };
          }
        } catch (error) {
          logger.error(`Error processing portal ${account.portal_id}:`, {
            error: error.message,
            stack: error.stack,
            status: error.status,
            details: error
          });
          return {
            portal_id: account.portal_id,
            status: 'error',
            error: error.message
          };
        }
      })
    );

    logger.info('=== Auto-training function completed ===');
    return new Response(
      JSON.stringify({ success: true, results }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200
      }
    );

  } catch (error) {
    logger.error('Fatal error:', {
      error: error.message,
      stack: error.stack,
      details: error
    });
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});