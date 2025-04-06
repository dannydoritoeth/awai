/// <reference types="deno" />
/// <reference lib="deno.window" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import OpenAI from 'https://esm.sh/openai@4.86.1';
import { HubspotClient, HubspotRecord } from '../_shared/hubspotClient.ts';
import { Logger } from '../_shared/logger.ts';
import { decrypt, encrypt } from '../_shared/encryption.ts';
import { DocumentPackager } from '../_shared/documentPackager.ts';
import { PineconeClient } from '../_shared/pineconeClient.ts';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const logger = new Logger('hubspot-auto-training-v2');

// Helper functions
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

function calculateConversionDays(properties: any): number {
  const createDate = new Date(properties.createdate);
  const closeDate = properties.closedate ? new Date(properties.closedate) : null;
  
  if (!closeDate) return 0;
  
  return Math.ceil((closeDate.getTime() - createDate.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Handles API calls with automatic token refresh
 */
async function handleApiCall<T>(
  hubspotClient: HubspotClient,
  portalId: string | number,
  refreshToken: string,
  apiCall: () => Promise<T>
): Promise<T> {
  try {
    return await apiCall();
  } catch (error) {
    logger.error(`API call error for portal ${portalId}:`, { message: error.message, status: error.status });

    // Check if the error is due to token expiration
    if (error.status === 401) {
      logger.info(`Refreshing expired token for portal ${portalId}`);
      
      try {
        // Refresh the token
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const refreshResult = await hubspotClient.refreshToken(
          refreshToken,
          Deno.env.get('HUBSPOT_CLIENT_ID')!,
          Deno.env.get('HUBSPOT_CLIENT_SECRET')!
        );

        if (!refreshResult || !refreshResult.access_token) {
          throw new Error('Failed to refresh token: Invalid response');
        }

        // Update the client with the new token
        hubspotClient.setToken(refreshResult.access_token);

        // Encrypt the new tokens and update in the database
        const encryptedAccessToken = await encrypt(
          refreshResult.access_token,
          Deno.env.get('ENCRYPTION_KEY')!
        );

        const encryptedRefreshToken = await encrypt(
          refreshResult.refresh_token,
          Deno.env.get('ENCRYPTION_KEY')!
        );

        const { error: updateError } = await supabase
          .from('hubspot_accounts')
          .update({
            access_token: encryptedAccessToken,
            refresh_token: encryptedRefreshToken,
            expires_at: new Date(Date.now() + 1800 * 1000).toISOString(), // Default to 30 minutes
            updated_at: new Date().toISOString()
          })
          .eq('portal_id', portalId);

        if (updateError) {
          throw new Error(`Failed to update tokens in database: ${updateError.message}`);
        }

        logger.info(`Successfully refreshed token for portal ${portalId}`);

        // Retry the API call with the new token
        return await apiCall();
      } catch (refreshError) {
        logger.error(`Token refresh failed for portal ${portalId}:`, refreshError);
        throw new Error(`Token refresh failed: ${refreshError.message}`);
      }
    }

    // For other errors, propagate them
    throw error;
  }
}

/**
 * Fetches deals for training from HubSpot
 */
async function getDealsForTraining(
  hubspotClient: HubspotClient, 
  type: 'ideal' | 'nonideal',
  portalId: string,
  refreshToken: string,
  documentPackager: DocumentPackager,
  openai: any,
  pineconeClient: PineconeClient
): Promise<{ total: number, processed: number }> {
  try {
    // Define time range - last 90 days
    const ninety_days_ago = new Date();
    ninety_days_ago.setDate(ninety_days_ago.getDate() - 90);
    
    let hasMore = true;
    let after: string | null = null;
    let totalDeals = 0;
    let processedDeals = 0;
    const namespace = `hubspot-${portalId}`;

    logger.info(`Fetching ${type} deals using namespace ${namespace}`);

    // Pagination loop to fetch deals in batches
    while (hasMore) {
      await sleep(2000); // Rate limiting

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
        limit: 10, // Fetch 10 at a time (reduced from 25 for more manageable batches)
        associations: ['contacts', 'companies'],
        ...(after ? { after } : {})
      };
      
      // Make API call with token refresh handling
      const dealsResponse = await handleApiCall(
        hubspotClient,
        portalId,
        refreshToken,
        () => hubspotClient.searchRecords('deals', searchCriteria)
      );
      
      logger.info(`Found ${dealsResponse.total || 0} total ${type} deals, fetched ${dealsResponse.results?.length || 0} in this batch`);
      
      if (dealsResponse.results?.length) {
        totalDeals += dealsResponse.results.length;
        
        // Process each deal in this batch individually
        const dealBatch = dealsResponse.results;
        for (const deal of dealBatch) {
          try {
            // Defensive checks
            if (!deal || !deal.id) {
              logger.error('Invalid deal object', { deal });
              continue;
            }

            logger.info(`Processing deal ${deal.id}, ${deal.properties?.dealname || 'unnamed'}`);

            try {
              // Get full details for the deal
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

              if (fullDeal) {
                // Preserve the associations from the search results
                fullDeal.associations = deal.associations;
                
                // Process this single deal right away
                await processSingleDeal(
                  fullDeal,
                  type,
                  hubspotClient,
                  documentPackager,
                  openai,
                  pineconeClient, 
                  portalId,
                  namespace
                );
                processedDeals++;
                logger.info(`Successfully processed deal ${fullDeal.id} (${processedDeals}/${totalDeals})`);
              }
            } catch (error) {
              logger.error(`Error processing deal ${deal.id}:`, error);
            }
            
            await sleep(3000); // Rate limiting between deals
          } catch (error) {
            logger.error(`Error handling deal ${deal?.id || 'unknown'}:`, error);
          }
        }

        logger.info(`Completed batch of ${dealBatch.length} deals (total: ${processedDeals}/${totalDeals})`);
        await sleep(5000); // Rate limiting between batches
      }

      // Check if more pages are available
      hasMore = dealsResponse.paging?.next?.after !== undefined;
      after = dealsResponse.paging?.next?.after || null;

      if (hasMore) {
        logger.info(`More deals available, continuing with after=${after}`);
      }
    }

    logger.info(`Completed processing ${type} deals: ${processedDeals}/${totalDeals}`);
    return { total: totalDeals, processed: processedDeals };
  } catch (error) {
    logger.error(`Error fetching and processing ${type} deals:`, error);
    throw error;
  }
}

/**
 * Process a single deal including its associations
 */
async function processSingleDeal(
  deal: any,
  classification: string,
  hubspotClient: any,
  documentPackager: DocumentPackager,
  openai: any,
  pineconeClient: PineconeClient,
  portalId: string,
  namespace: string
): Promise<void> {
  const processingStart = Date.now();
  
  logger.info(`Processing deal ${deal.id} (${classification})`);
  
  try {
    // Get all contacts and companies associated with this deal
    // Always fetch fresh associations to ensure we're getting all related records
    try {
      const associationsResult = await hubspotClient.getAssociations(deal.id, 'deal');
      if (associationsResult?.results) {
        // Extract contact and company IDs from associations
        const contactIds = associationsResult.results.contacts?.map(a => a.id) || [];
        const companyIds = associationsResult.results.companies?.map(a => a.id) || [];
        
        const totalAssociations = contactIds.length + companyIds.length;
        logger.info(`Found ${totalAssociations} associations for deal ${deal.id}`);
        
        // Create or update the associations structure
        if (!deal.associations) deal.associations = {};
        if (contactIds.length > 0) {
          deal.associations.contacts = {
            results: contactIds.map(id => ({ id }))
          };
        }
        if (companyIds.length > 0) {
          deal.associations.companies = {
            results: companyIds.map(id => ({ id }))
          };
        }
      }
    } catch (associationsError) {
      logger.error(`Error fetching associations: ${associationsError.message}`);
    }
    
    const associatedRecords = await getAssociatedRecords(hubspotClient, deal);
    
    // Process deal records
    logger.info(`Creating documents...`);
    const dealDocuments = [];
    
    try {
      const dealDocs = await documentPackager.packageDocument(deal, 'deal', portalId);
      if (dealDocs) {
        dealDocuments.push(dealDocs);
      }
    } catch (dealError) {
      logger.error(`Error creating deal document: ${dealError.message}`);
    }
    
    // Process contact records
    const contactDocuments = [];
    
    try {
      for (const contact of associatedRecords.contacts) {
        try {
          const contactDoc = await documentPackager.packageDocument(contact, 'contact', portalId);
          if (contactDoc) {
            contactDocuments.push(contactDoc);
          }
        } catch (contactError) {
          logger.error(`Error packaging contact ${contact.id}: ${contactError.message}`);
        }
      }
    } catch (contactsError) {
      logger.error(`Error creating contact documents: ${contactsError.message}`);
    }
    
    // Process company records
    const companyDocuments = [];
    
    try {
      for (const company of associatedRecords.companies) {
        try {
          const companyDoc = await documentPackager.packageDocument(company, 'company', portalId);
          if (companyDoc) {
            companyDocuments.push(companyDoc);
          }
        } catch (companyError) {
          logger.error(`Error packaging company ${company.id}: ${companyError.message}`);
        }
      }
    } catch (companiesError) {
      logger.error(`Error creating company documents: ${companiesError.message}`);
    }
    
    // Calculate deal metadata for all records
    const dealMetadata = {
      deal_id: deal.id,
      deal_value: parseFloat(deal.properties?.amount) || 0,
      conversion_days: calculateConversionDays(deal.properties || {}),
      pipeline: deal.properties?.pipeline || 'unknown',
      dealstage: deal.properties?.dealstage || 'unknown',
      days_in_pipeline: parseInt(deal.properties?.hs_time_in_pipeline) || 0,
      classification
    };
    
    // Combine all documents and add metadata
    const allDocuments = [
      ...dealDocuments.map(doc => ({
        ...doc,
        metadata: { ...doc.metadata, ...dealMetadata, record_type: 'deal' }
      })),
      ...contactDocuments.map(doc => ({
        ...doc,
        metadata: { ...doc.metadata, ...dealMetadata, record_type: 'contact' }
      })),
      ...companyDocuments.map(doc => ({
        ...doc,
        metadata: { ...doc.metadata, ...dealMetadata, record_type: 'company' }
      }))
    ];
    
    logger.info(`Created ${allDocuments.length} documents for deal ${deal.id}`);
    
    if (allDocuments.length === 0) {
      logger.warn(`No documents created for deal ${deal.id}. Skipping embeddings.`);
      return;
    }
    
    // Generate embeddings for all documents
    logger.info(`Generating embeddings for ${allDocuments.length} documents`);
    let documentsWithEmbeddings = [];
    
    try {
      // Process in batches to avoid rate limits
      const batchSize = 10;
      for (let i = 0; i < allDocuments.length; i += batchSize) {
        const batch = allDocuments.slice(i, i + batchSize);
        
        const embeddingResponse = await openai.embeddings.create({
          model: "text-embedding-3-large",
          input: batch.map(doc => doc.content),
          encoding_format: "float"
        });
        
        const batchWithEmbeddings = batch.map((doc, index) => ({
          ...doc,
          embedding: embeddingResponse.data[index].embedding
        }));
        
        documentsWithEmbeddings.push(...batchWithEmbeddings);
        
        if (i + batchSize < allDocuments.length) {
          await sleep(500);
        }
      }
    } catch (embeddingsError) {
      logger.error(`Error generating embeddings: ${embeddingsError.message}`);
      throw embeddingsError;
    }
    
    if (documentsWithEmbeddings.length === 0) {
      logger.warn(`No documents with embeddings created for deal ${deal.id}.`);
      return;
    }
    
    // Upsert to Pinecone
    logger.info(`Upserting ${documentsWithEmbeddings.length} vectors to namespace ${namespace}`);
    try {
      // Create vectors
      const vectors = documentsWithEmbeddings.map(doc => ({
        id: doc.metadata.id.toString(),
        values: Array.from(doc.embedding),
        metadata: {
          ...doc.metadata
        }
      }));
      
      // Before upserting, check if these vectors already exist with the same deal metadata
      const vectorIds = vectors.map(v => v.id);
      try {
        // Fetch existing vectors in batches (limit by Pinecone API)
        const batchSize = 100;
        const existingVectors = new Map();
        
        for (let i = 0; i < vectorIds.length; i += batchSize) {
          const batchIds = vectorIds.slice(i, i + batchSize);
          
          try {
            const fetchResult = await pineconeClient.query(namespace, null, { id: { $in: batchIds } }, batchIds.length);
            
            if (fetchResult.matches?.length > 0) {
              // Store existing vectors to compare later
              fetchResult.matches.forEach(vector => {
                existingVectors.set(vector.id, {
                  metadata: vector.metadata
                });
              });
            }
          } catch (fetchBatchError) {
            logger.error(`Error fetching batch of vectors: ${fetchBatchError.message}`);
            // Continue with next batch
          }
        }
        
        // Filter vectors that have changed
        const vectorsToUpsert = vectors.filter(vector => {
          // If vector doesn't exist, include it
          if (!existingVectors.has(vector.id)) {
            return true;
          }
          
          // If vector exists, check if metadata has changed
          const existingVector = existingVectors.get(vector.id);
          // Compare deal metadata
          const dealMetadataChanged = 
            existingVector.metadata.deal_id !== vector.metadata.deal_id ||
            existingVector.metadata.deal_value !== vector.metadata.deal_value ||
            existingVector.metadata.conversion_days !== vector.metadata.conversion_days ||
            existingVector.metadata.pipeline !== vector.metadata.pipeline ||
            existingVector.metadata.dealstage !== vector.metadata.dealstage ||
            existingVector.metadata.days_in_pipeline !== vector.metadata.days_in_pipeline;
            
          return dealMetadataChanged;
        });
        
        // Only upsert if there are changes
        if (vectorsToUpsert.length > 0) {
          logger.info(`Upserting ${vectorsToUpsert.length} changed vectors`);
          
          // Prepare deal info for upserting
          const dealInfo = {
            deal_id: deal.id,
            deal_value: parseFloat(deal.properties?.amount) || 0,
            conversion_days: calculateConversionDays(deal.properties || {}),
            pipeline: deal.properties?.pipeline || 'unknown',
            dealstage: deal.properties?.dealstage || 'unknown',
            days_in_pipeline: parseInt(deal.properties?.hs_time_in_pipeline) || 0
          };
          
          // Call the proper upsert method
          await pineconeClient.upsertVectorsWithDealMetadata(
            namespace,
            documentsWithEmbeddings.filter(doc => 
              vectorsToUpsert.some(v => v.id === doc.metadata.id.toString())
            ),
            documentsWithEmbeddings
              .filter(doc => vectorsToUpsert.some(v => v.id === doc.metadata.id.toString()))
              .map(doc => ({ embedding: doc.embedding })),
            dealInfo
          );
        } else {
          logger.info(`No vectors changed, skipping upsert for deal ${deal.id}`);
        }
      } catch (fetchError) {
        // If error fetching (like namespace doesn't exist), just upsert all
        logger.warn(`Error checking existing vectors: ${fetchError.message}. Will upsert all vectors.`);
        
        // Upsert to Pinecone
        const dealInfo = {
          deal_id: deal.id,
          deal_value: parseFloat(deal.properties?.amount) || 0,
          conversion_days: calculateConversionDays(deal.properties || {}),
          pipeline: deal.properties?.pipeline || 'unknown',
          dealstage: deal.properties?.dealstage || 'unknown',
          days_in_pipeline: parseInt(deal.properties?.hs_time_in_pipeline) || 0
        };
        
        // Call the proper upsert method
        await pineconeClient.upsertVectorsWithDealMetadata(
          namespace,
          documentsWithEmbeddings,
          documentsWithEmbeddings.map(doc => ({ embedding: doc.embedding })),
          dealInfo
        );
      }
      
    } catch (pineconeError) {
      logger.error(`Error in Pinecone operations: ${pineconeError.message}`);
      throw pineconeError;
    }
    
    const processingDuration = (Date.now() - processingStart) / 1000;
    logger.info(`Deal ${deal.id} processed in ${processingDuration.toFixed(2)} seconds`);
    
  } catch (error) {
    const processingDuration = (Date.now() - processingStart) / 1000;
    logger.error(`Deal ${deal.id} processing failed after ${processingDuration.toFixed(2)} seconds: ${error.message}`);
    throw error;
  }
}

/**
 * Fetches contacts and companies associated with a deal
 */
async function getAssociatedRecords(hubspotClient: HubspotClient, deal: any) {
  const contacts: HubspotRecord[] = [];
  const companies: HubspotRecord[] = [];

  try {
    // If we don't have associations but have a deal ID, try to fetch associations directly
    if ((!deal.associations || (!deal.associations?.contacts?.results?.length && !deal.associations?.companies?.results?.length)) && deal.id) {
      try {
        // Fetch associations directly using the HubSpot API
        const associationsResult = await hubspotClient.getAssociations(deal.id, 'deal');
        
        if (associationsResult?.results) {
          // Extract contact and company IDs
          const contactIds = associationsResult.results.contacts?.map(a => a.id) || [];
          const companyIds = associationsResult.results.companies?.map(a => a.id) || [];
          
          // Create a synthetic associations structure for processing below
          if (!deal.associations) deal.associations = {};
          if (contactIds.length > 0) {
            deal.associations.contacts = {
              results: contactIds.map(id => ({ id }))
            };
          }
          if (companyIds.length > 0) {
            deal.associations.companies = {
              results: companyIds.map(id => ({ id }))
            };
          }
        }
      } catch (associationsError) {
        logger.error(`Error fetching associations: ${associationsError.message}`);
      }
    }
    
    // Check for associated contacts
    if (deal.associations?.contacts?.results?.length > 0) {
      for (const contact of deal.associations.contacts.results) {
        try {
          const contactData = await hubspotClient.getContact(contact.id);
          if (contactData) {
            contacts.push(contactData);
          }
          await sleep(1000); // Rate limiting
        } catch (error) {
          logger.error(`Error fetching contact ${contact.id}: ${error.message}`);
        }
      }
    }

    // Check for associated companies
    if (deal.associations?.companies?.results?.length > 0) {
      for (const company of deal.associations.companies.results) {
        try {
          const companyData = await hubspotClient.getCompany(company.id);
          if (companyData) {
            companies.push(companyData);
          }
          await sleep(1000); // Rate limiting
        } catch (error) {
          logger.error(`Error fetching company ${company.id}: ${error.message}`);
        }
      }
    }

    return { contacts, companies };
  } catch (error) {
    logger.error(`Error fetching associated records: ${error.message}`);
    // Return whatever we managed to retrieve
    return { contacts, companies };
  }
}

/**
 * Main handler for the edge function
 */
serve(async (req) => {
  try {
    logger.info('Starting hubspot-auto-training-v2');
    
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
      .select('*')
      .eq('status', 'active');

    if (accountsError) {
      throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
    }

    if (!accounts || accounts.length === 0) {
      throw new Error('No active HubSpot accounts found');
    }

    logger.info(`Found ${accounts.length} active HubSpot accounts to process`);

    // Track results
    const results = {
      total: accounts.length,
      processed: 0,
      successful: 0,
      failed: 0,
      portals: [] as any[]
    };

    // Process each account
    for (const account of accounts) {
      const portalId = account.portal_id;
      logger.info(`Processing portal ${portalId}`);

      try {
        // Initialize clients and services
        const decryptedToken = await decrypt(account.access_token, Deno.env.get('ENCRYPTION_KEY')!);
        const decryptedRefreshToken = await decrypt(account.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);
        
        if (!decryptedToken || !decryptedRefreshToken) {
          throw new Error('Invalid HubSpot tokens');
        }
        
        logger.info(`Initializing services for portal ${portalId}`);

        const hubspotClient = new HubspotClient(decryptedToken);
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
        const openai = new OpenAI({ apiKey: openaiApiKey });
        const pineconeApiKey = Deno.env.get('PINECONE_API_KEY')!;
        const pineconeIndex = Deno.env.get('PINECONE_INDEX')!;
        const pineconeClient = new PineconeClient();
        await pineconeClient.initialize(pineconeApiKey, pineconeIndex);
        const documentPackager = new DocumentPackager(hubspotClient);
        logger.info(`Services initialized for portal ${portalId}`);
        
        // Validate token
        logger.info(`Validating token for portal ${portalId}`);
        await handleApiCall(hubspotClient, portalId, decryptedRefreshToken, () => 
          hubspotClient.searchRecords('contacts', { limit: 1 })
        );
        
        // Track portal results
        const portalResult = {
          portalId,
          ideal: { total: 0, processed: 0 },
          nonideal: { total: 0, processed: 0 }
        };
        
        // Process ideal deals
        try {
          logger.info(`Starting ideal deals processing for portal ${portalId}`);
          
          const idealDeals = await getDealsForTraining(hubspotClient, 'ideal', portalId, decryptedRefreshToken, documentPackager, openai, pineconeClient);
          
          portalResult.ideal.total = idealDeals.total;
          portalResult.ideal.processed = idealDeals.processed;
          
          logger.info(`Processed ${idealDeals.processed} ideal deals for portal ${portalId}`);
          
        } catch (idealDealsError) {
          logger.error(`Error processing ideal deals for portal ${portalId}: ${idealDealsError.message}`);
        }
        
        // Process non-ideal deals
        logger.info(`Starting non-ideal deals processing for portal ${portalId}`);
        const nonIdealDeals = await getDealsForTraining(hubspotClient, 'nonideal', portalId, decryptedRefreshToken, documentPackager, openai, pineconeClient);
        portalResult.nonideal.total = nonIdealDeals.total;
        portalResult.nonideal.processed = nonIdealDeals.processed;
        
        logger.info(`Processed ${nonIdealDeals.processed} non-ideal deals for portal ${portalId}`);
        
        // Update database with metrics
        await supabase
          .from('hubspot_accounts')
          .update({
            last_training_date: new Date().toISOString(),
            current_ideal_deals: portalResult.ideal.processed,
            current_less_ideal_deals: portalResult.nonideal.processed
          })
          .eq('portal_id', portalId);
        
        // Track success
        results.portals.push(portalResult);
        results.successful++;
        logger.info(`Successfully processed portal ${portalId}`);
      } catch (error) {
        // Track failure
        results.failed++;
        logger.error(`Failed to process portal ${portalId}: ${error.message}`);
        results.portals.push({
          portalId,
          error: error.message
        });
      }
      
      results.processed++;
    }

    // Return the response
    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.processed} HubSpot accounts`,
        results
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    logger.error('Error in hubspot-auto-training-v2:', error);
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