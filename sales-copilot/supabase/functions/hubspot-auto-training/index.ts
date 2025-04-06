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

// Add these helper functions for rate limiting and batching
async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function getDealsForTraining(
  hubspotClient: HubspotClient, 
  type: 'ideal' | 'nonideal',
  portalId: string,
  refreshToken: string
): Promise<any[]> {
  try {
    const ninety_days_ago = new Date();
    ninety_days_ago.setDate(ninety_days_ago.getDate() - 90);
    const today = new Date();
    const allDeals: any[] = [];
    let hasMore = true;
    let after: string | null = null;

    while (hasMore) {
      await sleep(2000);

      const searchCriteria = {
        filterGroups: [{
          filters: [
            {
              propertyName: 'createdate',
              operator: 'GTE',
              value: Math.floor(ninety_days_ago.getTime() / 1000).toString()
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
            propertyName: 'createdate',
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
        limit: 25,
        associations: ['contacts', 'companies'],
        ...(after ? { after } : {})
      };

      logger.info(`Searching for ${type} deals with criteria:`, JSON.stringify(searchCriteria, null, 2));
      
      const deals = await handleApiCall(
        hubspotClient,
        portalId,
        refreshToken,
        () => hubspotClient.searchRecords('deals', searchCriteria)
      );
      
      logger.info(`Found ${deals.total || 0} total ${type} deals, fetched ${deals.results?.length || 0} in this batch`);
      
      if (deals.results?.length) {
        // Log some sample data to verify associations
        const sampleDeal = deals.results[0];
        logger.info('Sample deal associations:', {
          dealId: sampleDeal.id,
          hasAssociations: !!sampleDeal.associations,
          contactsCount: sampleDeal.associations?.contacts?.results?.length || 0,
          companiesCount: sampleDeal.associations?.companies?.results?.length || 0
        });
        
        allDeals.push(...deals.results);
      }

      hasMore = deals.paging?.next?.after !== undefined;
      after = deals.paging?.next?.after || null;

      if (hasMore) {
        logger.info(`More deals available, continuing with after=${after}`);
        await sleep(5000);
      }
    }

    logger.info(`Total ${type} deals collected: ${allDeals.length}`);
    
    // Process full deal details in smaller batches
    const fullDeals: any[] = [];
    const dealBatches = chunkArray(allDeals, 5);

    for (const batch of dealBatches) {
      logger.info(`Processing batch of ${batch.length} deals`);
      
      for (const deal of batch) {
        try {
          // Log the raw deal object to see what we're working with
          logger.info('Raw deal object:', {
            id: deal?.id,
            properties: deal?.properties ? Object.keys(deal.properties) : 'no properties',
            associations: deal?.associations ? Object.keys(deal.associations) : 'no associations'
          });

          // Add defensive checks
          if (!deal) {
            logger.error('Deal object is null or undefined');
            continue;
          }

          if (!deal.id) {
            logger.error('Deal has no ID');
            continue;
          }

          await sleep(3000);
          logger.info(`Starting to fetch full deal details for ${deal.id}`);

          try {
            const fullDeal = await handleApiCall(
              hubspotClient,
              portalId,
              refreshToken,
              () => hubspotClient.getRecord('deals', deal.id, [
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
              ])
            );

            logger.info(`Successfully fetched full deal details for ${deal.id}`);
            
            if (fullDeal) {
              // Log the full deal object
              logger.info('Full deal details:', {
                id: fullDeal.id,
                properties: fullDeal.properties ? Object.keys(fullDeal.properties) : 'no properties',
                hasAssociations: !!deal.associations
              });

              // Preserve the associations from the search results
              fullDeal.associations = deal.associations;
              fullDeals.push(fullDeal);
              logger.info(`Added deal ${deal.id} to fullDeals array`);
              await sleep(1000);
            } else {
              logger.error(`getRecord returned null for deal ${deal.id}`);
            }
          } catch (getRecordError) {
            logger.error(`Error in getRecord for deal ${deal.id}:`, {
              error: getRecordError.message,
              status: getRecordError.status,
              response: getRecordError.response,
              stack: getRecordError.stack
            });
            await sleep(5000);
          }
        } catch (error) {
          logger.error(`Error in main deal processing loop for deal ${deal?.id || 'unknown'}:`, {
            error: error.message,
            stack: error.stack,
            dealObject: deal ? 'exists' : 'null'
          });
          await sleep(5000);
        }
      }

      logger.info(`Batch processing complete. Processed ${batch.length} deals, got ${fullDeals.length} full deals`);
      await sleep(8000);
    }

    return fullDeals;
  } catch (error) {
    logger.error(`Error fetching ${type} deals:`, error);
    throw error;
  }
}

async function getAssociatedRecords(hubspotClient: HubspotClient, deal: any) {
  const contacts: HubspotRecord[] = [];
  const companies: HubspotRecord[] = [];

  try {
    logger.info(`Checking associations for deal ${deal.id}:`, {
      hasAssociations: !!deal.associations,
      contactsCount: deal.associations?.contacts?.results?.length || 0,
      companiesCount: deal.associations?.companies?.results?.length || 0
    });

    // Get associated contacts sequentially
    if (deal.associations?.contacts?.results?.length > 0) {
      logger.info(`Fetching ${deal.associations.contacts.results.length} associated contacts for deal ${deal.id}`);
      
      for (const contact of deal.associations.contacts.results) {
        try {
          const contactData = await hubspotClient.getContact(contact.id);
          if (contactData) {
            logger.info(`Successfully fetched contact ${contact.id} for deal ${deal.id}`);
            contacts.push(contactData);
          }
          // Add delay between contact fetches
          await sleep(1000);
        } catch (error) {
          logger.error(`Error fetching contact ${contact.id}:`, error);
        }
      }
    } else {
      logger.info(`No contacts associated with deal ${deal.id}`);
    }

    // Get associated companies sequentially
    if (deal.associations?.companies?.results?.length > 0) {
      logger.info(`Fetching ${deal.associations.companies.results.length} associated companies for deal ${deal.id}`);
      
      for (const company of deal.associations.companies.results) {
        try {
          const companyData = await hubspotClient.getCompany(company.id);
          if (companyData) {
            logger.info(`Successfully fetched company ${company.id} for deal ${deal.id}`);
            companies.push(companyData);
          }
          // Add delay between company fetches
          await sleep(1000);
        } catch (error) {
          logger.error(`Error fetching company ${company.id}:`, error);
        }
      }
    } else {
      logger.info(`No companies associated with deal ${deal.id}`);
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

      // Create a unique document ID using recordId-type format
      const documentId = `${record.id}-${type}`;

      return {
        id: documentId,
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
    
    // Check if we need to refresh the token
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
  } catch (error) {
    logger.error(`[Token Validation] Fatal error for portal ${portalId}:`, {
      message: error.message,
      stack: error.stack,
      details: error
    });
    throw error;
  }
}

// Add a new function to handle token refresh during API calls
async function handleApiCall<T>(
  hubspotClient: HubspotClient,
  portalId: string,
  refreshToken: string,
  apiCall: () => Promise<T>
): Promise<T> {
  try {
    return await apiCall();
  } catch (error) {
    if (error.message?.includes('401') || error.message?.includes('expired')) {
      logger.info(`Token expired during API call for portal ${portalId}, refreshing...`);
      const newTokens = await refreshHubSpotToken(refreshToken);
      hubspotClient.updateToken(newTokens.access_token);
      logger.info('Token refreshed, retrying API call');
      return await apiCall();
    }
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
  
  // Process deals in smaller batches
  const dealBatches = chunkArray(deals, 5);
  logger.info(`Split deals into ${dealBatches.length} batches of 5`);
  
  for (const batch of dealBatches) {
    logger.info(`Starting batch processing of ${batch.length} ${classification} deals`);
    logger.info('Batch deal IDs:', batch.map(d => d.id));
    
    for (const deal of batch) {
      try {
        logger.info(`\n=== Starting processing of deal ${deal.id} ===`);
        logger.info('Deal details:', {
          id: deal.id,
          name: deal.properties?.dealname,
          stage: deal.properties?.dealstage,
          hasAssociations: !!deal.associations
        });

        await sleep(2000);
        logger.info('Initial delay complete');

        // Get associated records
        logger.info(`Starting to fetch associated records for deal ${deal.id}`);
        const { contacts, companies } = await getAssociatedRecords(hubspotClient, deal);
        logger.info(`Completed fetching associated records: ${contacts.length} contacts, ${companies.length} companies`);

        // Calculate deal metrics
        logger.info(`Starting to calculate metrics for deal ${deal.id}`);
        const dealMetadata = calculateDealMetrics(deal, contacts, companies);
        logger.info('Deal metrics calculated:', dealMetadata);

        // Create documents
        logger.info(`Starting document creation for deal ${deal.id}`);
        
        logger.info('Creating deal documents...');
        const dealDocs = await createDocuments(documentPackager, [deal], 'deal', portalId, classification, dealMetadata);
        logger.info(`Created ${dealDocs.length} deal documents`);
        await sleep(2000);
        
        logger.info('Creating contact documents...');
        const contactDocs = contacts.length > 0 ? 
          await createDocuments(documentPackager, contacts, 'contact', portalId, classification, dealMetadata) : 
          [];
        logger.info(`Created ${contactDocs.length} contact documents`);
        await sleep(2000);
        
        logger.info('Creating company documents...');
        const companyDocs = companies.length > 0 ? 
          await createDocuments(documentPackager, companies, 'company', portalId, classification, dealMetadata) : 
          [];
        logger.info(`Created ${companyDocs.length} company documents`);

        const documents = [...dealDocs, ...contactDocs, ...companyDocs];
        logger.info(`Total documents created: ${documents.length}`);
        logger.info('Document IDs:', documents.map(doc => doc.id));

        // Get embeddings
        logger.info(`Starting OpenAI embedding creation for ${documents.length} documents`);
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-large',
          input: documents.map(doc => doc.content)
        });
        logger.info(`Successfully received ${embeddingResponse.data.length} embeddings from OpenAI`);

        await sleep(2000);
        logger.info('Post-embedding delay complete');

        // Prepare vectors
        logger.info('Starting vector preparation');
        const vectors = documents.map((doc, index) => ({
          id: doc.id,
          values: Array.from(embeddingResponse.data[index].embedding),
          metadata: doc.metadata
        }));

        logger.info('Vectors prepared:', vectors.map(v => ({
          id: v.id,
          metadata: {
            record_type: v.metadata.record_type,
            deal_id: v.metadata.deal_id,
            classification: v.metadata.classification
          },
          vectorLength: v.values.length
        })));

        // Upsert to Pinecone
        const namespace = `hubspot-${portalId}`;
        logger.info(`Starting Pinecone upsert of ${vectors.length} vectors to namespace ${namespace}`);
        
        try {
          logger.info('Calling Pinecone upsert...');
          const upsertResponse = await index.namespace(namespace).upsert(vectors);
          logger.info('Pinecone upsert completed:', upsertResponse);
          
          // Verify the upsert
          logger.info('Starting upsert verification...');
          const sampleVector = vectors[0];
          const queryResponse = await index.namespace(namespace).fetch([sampleVector.id]);
          logger.info('Upsert verification complete:', {
            queriedId: sampleVector.id,
            found: queryResponse.records.length > 0,
            response: queryResponse
          });
        } catch (pineconeError) {
          logger.error('Pinecone operation failed:', {
            error: pineconeError.message,
            stack: pineconeError.stack,
            namespace,
            vectorCount: vectors.length,
            sampleVectorId: vectors[0]?.id
          });
          throw pineconeError;
        }

        logger.info(`=== Successfully completed processing deal ${deal.id} ===\n`);
        await sleep(3000);
        
      } catch (error) {
        logger.error(`Error processing deal ${deal.id}:`, {
          error: error.message,
          stack: error.stack,
          dealId: deal.id,
          dealName: deal.properties?.dealname
        });
        await sleep(5000);
      }
    }
    
    logger.info(`\n=== Completed processing batch of ${batch.length} deals ===`);
    await sleep(10000);
  }
  
  logger.info(`\n=== Completed processing all ${classification} deals ===`);
}

async function processRecords(
  records: any[], 
  type: string, 
  portalId: string, 
  hubspotClient: HubspotClient,
  refreshToken: string,
  shouldClearNamespace: boolean = false
) {
  const logger = new Logger('processRecords');
  logger.info(`Processing ${records.length} ${type} records for portal ${portalId}`);

  // Query HubSpot for ideal and less ideal counts using handleApiCall
  const idealQuery = await handleApiCall(hubspotClient, portalId, refreshToken, () =>
    hubspotClient.searchRecords(type, {
      filterGroups: [{
        filters: [{
          propertyName: 'training_score',
          operator: 'GTE',
          value: '80'
        }]
      }],
      limit: 1,
      after: 0
    })
  );

  const lessIdealQuery = await handleApiCall(hubspotClient, portalId, refreshToken, () =>
    hubspotClient.searchRecords(type, {
      filterGroups: [{
        filters: [{
          propertyName: 'training_score',
          operator: 'LT',
          value: '50'
        }]
      }],
      limit: 1,
      after: 0
    })
  );

  const currentIdealCount = idealQuery.total;
  const currentLessIdealCount = lessIdealQuery.total;

  // Update counts in database based on record type
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const updateData = {
    last_training_date: new Date().toISOString()
  };

  // Add the appropriate counts based on record type
  if (type === 'contacts') {
    Object.assign(updateData, {
      current_ideal_contacts: currentIdealCount,
      current_less_ideal_contacts: currentLessIdealCount
    });
  } else if (type === 'companies') {
    Object.assign(updateData, {
      current_ideal_companies: currentIdealCount,
      current_less_ideal_companies: currentLessIdealCount
    });
  } else if (type === 'deals') {
    Object.assign(updateData, {
      current_ideal_deals: currentIdealCount,
      current_less_ideal_deals: currentLessIdealCount
    });
  }

  const { error: updateError } = await supabase
    .from('hubspot_accounts')
    .update(updateData)
    .eq('portal_id', portalId);

  if (updateError) {
    logger.error('Failed to update training metrics:', updateError);
    throw new Error('Failed to update training metrics');
  }

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: Deno.env.get('OPENAI_API_KEY')!
  });

  // Initialize Pinecone client
  const pinecone = new Pinecone({
    apiKey: Deno.env.get('PINECONE_API_KEY')!
  });

  const index = pinecone.index(Deno.env.get('PINECONE_INDEX')!);
  const namespace = `hubspot-${portalId}`;

  // Delete all existing vectors in the namespace if this is the first record type
  if (shouldClearNamespace) {
    try {
      logger.info(`Attempting to delete existing vectors in namespace: ${namespace}`);
      await index.deleteAll({ namespace });
      logger.info(`Successfully deleted vectors in namespace: ${namespace}`);
    } catch (error) {
      // If the namespace doesn't exist (404), we can ignore the error
      if (error.message.includes('404')) {
        logger.info(`Namespace ${namespace} does not exist, skipping deletion`);
      } else {
        // For other errors, log them but continue processing
        logger.warn(`Error deleting vectors in namespace ${namespace}:`, error);
      }
    }
  }

  const documentPackager = new DocumentPackager(hubspotClient);

  // Process each record through the document packager
  const documents = await Promise.all(
    records.map(record => documentPackager.packageDocument(record, type as 'contact' | 'company' | 'deal', portalId))
  );

  logger.info(`Created ${documents.length} documents`);

  // Get embeddings for all documents using OpenAI
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: documents.map(doc => doc.content)
  });

  logger.info('Embedding response structure:', {
    hasData: !!embeddingResponse.data,
    firstEmbeddingLength: embeddingResponse.data[0]?.embedding?.length,
    isEmbeddingArray: Array.isArray(embeddingResponse.data[0]?.embedding)
  });

  // Create vectors for all documents
  const vectors = documents.map((doc, index) => ({
    id: doc.metadata.id.toString(),
    values: Array.from(embeddingResponse.data[index].embedding),
    metadata: {
      id: doc.metadata.id.toString(),
      recordType: doc.metadata.recordType,
      updatedAt: doc.metadata.updatedAt
    }
  }));

  logger.info('Vector structure:', {
    totalVectors: vectors.length,
    firstVector: {
      hasId: !!vectors[0]?.id,
      valuesLength: vectors[0]?.values?.length,
      isValuesArray: Array.isArray(vectors[0]?.values),
      metadata: vectors[0]?.metadata
    },
    namespace
  });

  try {
    logger.info(`Attempting to upsert ${vectors.length} vectors into namespace: ${namespace}`);
    await index.namespace(namespace).upsert(vectors);
    logger.info(`Successfully upserted ${vectors.length} vectors into namespace: ${namespace}`);
  } catch (error) {
    logger.error('Error upserting vectors:', error);
    logger.error('Error upserting vectors - first vector:', JSON.stringify(vectors[0]));
    logger.error('Attempted namespace:', namespace);
    throw error;
  }

  return vectors.length; // Return the number of vectors processed
}

serve(async (req) => {
  try {
    logger.info('Starting process training function');
    
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // Validate request method
    if (req.method !== "POST") {
      throw new Error(`Method ${req.method} not allowed. Only POST requests are accepted.`);
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch all HubSpot accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('hubspot_accounts')
      .select('*');

    if (accountsError) {
      logger.error('Error fetching accounts from Supabase:', accountsError);
      throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
    }

    if (!accounts || accounts.length === 0) {
      throw new Error('No HubSpot accounts found');
    }

    logger.info(`Found ${accounts.length} HubSpot accounts to process`);

    // Process each account
    const allResults = {
      total: accounts.length,
      processed: 0,
      successful: 0,
      failed: 0,
      portals: [] as any[]
    };

    for (const account of accounts) {
      const portalId = account.portal_id;
      logger.info(`Processing portal ${portalId}`);

      try {
        // Decrypt tokens
        let decryptedToken = await decrypt(account.access_token, Deno.env.get('ENCRYPTION_KEY')!);
        const decryptedRefreshToken = await decrypt(account.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);
        
        if (!decryptedToken || !decryptedRefreshToken) {
          throw new Error('HubSpot tokens are missing or invalid');
        }

        // Initialize HubSpot client with current token
        const hubspotClient = new HubspotClient(decryptedToken);

        // Test token and refresh if needed
        try {
          await handleApiCall(hubspotClient, portalId, decryptedRefreshToken, () => 
            hubspotClient.searchRecords('contacts', { limit: 1 })
          );
          logger.info('Token validation successful');
        } catch (error) {
          logger.error(`Token validation failed for portal ${portalId}:`, error);
          throw error;
        }

        // Process each record type
        const recordTypes = ['contacts', 'companies', 'deals'];
        const portalResults = {
          portalId,
          contacts: { processed: 0, successful: 0, failed: 0, errors: [] as any[] },
          companies: { processed: 0, successful: 0, failed: 0, errors: [] as any[] },
          deals: { processed: 0, successful: 0, failed: 0, errors: [] as any[] }
        };

        for (const type of recordTypes) {
          try {
            logger.info(`Processing ${type} for portal ${portalId}`);
            
            // Use handleApiCall for the search
            const searchResponse = await handleApiCall(hubspotClient, portalId, decryptedRefreshToken, () =>
              hubspotClient.searchRecords(type, {
                limit: 100
              })
            );

            if (searchResponse.total > 0) {
              portalResults[type].processed = searchResponse.total;
              await processRecords(
                searchResponse.results, 
                type, 
                portalId.toString(), 
                hubspotClient,
                decryptedRefreshToken,
                type === 'contacts'
              );
              portalResults[type].successful = searchResponse.total;
            }
          } catch (error) {
            portalResults[type].failed = 1;
            const errorDetails = {
              message: error.message,
              stack: error.stack,
              cause: error.cause,
              type: error.name
            };
            portalResults[type].errors.push(errorDetails);
            logger.error(`Error processing ${type} for portal ${portalId}:`, errorDetails);
          }
        }

        allResults.portals.push(portalResults);
        allResults.successful++;
      } catch (error) {
        allResults.failed++;
        logger.error(`Failed to process portal ${portalId}:`, error);
        allResults.portals.push({
          portalId,
          error: error.message
        });
      }

      allResults.processed++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${allResults.processed} portals`,
        results: allResults
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    logger.error('Error in process training function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});