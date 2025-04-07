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

// Enhance filterVectorsToUpdate to check for existing vectors
function filterVectorsToUpdate(
  dealsToProcess: any[], 
  existingVectors: any[]
): any[] {
  try {
    // Create a map of existing vectors by ID for faster lookup
    const existingVectorsMap = new Map<string, any>();
    
    if (Array.isArray(existingVectors) && existingVectors.length > 0) {
      existingVectors.forEach(vector => {
        if (vector && vector.id) {
          existingVectorsMap.set(vector.id.toString(), vector);
          logger.info(`Adding vector ${vector.id} to existing vectors map`);
        }
      });
      
      logger.info(`Created existing vectors map with ${existingVectorsMap.size} entries`);
    } else {
      logger.info('No existing vectors found, will process all deals');
      return dealsToProcess;
    }
    
    // Filter deals to only include those that need updating
    const dealsToUpdate = dealsToProcess.filter(deal => {
      const dealId = deal.id.toString();
      
      // Check if vector exists in existing vectors
      const existingVector = existingVectorsMap.get(dealId);
      
      if (!existingVector) {
        logger.info(`Deal ${dealId} not found in existing vectors, will process`);
        return true;
      }
      
      logger.info(`Deal ${dealId} already exists in Pinecone, skipping update`);
      return false;
    });
    
    logger.info(`Filtered deals to update: ${dealsToUpdate.length} out of ${dealsToProcess.length}`);
    return dealsToUpdate;
  } catch (error) {
    logger.error(`Error filtering vectors to update: ${error.message}`);
    // If filtering fails, return all deals to be safe
    return dealsToProcess;
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
  pineconeClient: PineconeClient,
  supabase: any // Add supabase client parameter
): Promise<{ total: number, processed: number, dealAmounts: number[] }> {
  try {
    const dealStage = type === 'ideal' ? 'closedwon' : 'closedlost';
    
    // Define time range - last 90 days
    const ninety_days_ago = new Date();
    ninety_days_ago.setDate(ninety_days_ago.getDate() - 90);
    
    // Define propertyNames to fetch
    const propertyNames = [
      'dealname',
      'createdate',
      'closedate',
      'amount',
      'dealstage',
      'hs_lastmodifieddate',
      'hs_object_id',
      'description',
      'notes_last_updated'
    ];
    
    let totalDeals = 0;
    let processedDeals = 0;
    const namespace = `hubspot-${portalId}`;
    // Track all deal amounts for statistics
    const dealAmounts: number[] = [];
    
    logger.info(`Fetching ${dealStage} deals using namespace ${namespace}`);
    
    let hasMore = true;
    let after: string | null = null;

    logger.info(`Fetching ${type} deals using namespace ${namespace}`);

    // Incremental statistics tracking
    let batchCount = 0;
    const batchSize = 5; // Update stats every 5 batches processed

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
              value: dealStage
            }
          ]
        }],
        sorts: [
          {
            propertyName: 'createdate',
            direction: 'DESCENDING'
          }
        ],
        properties: propertyNames,
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
      
      // Fix for linter error - ensure dealsResponse is properly handled
      if (!dealsResponse || typeof dealsResponse !== 'object') {
        logger.error(`Invalid response from deals search: ${JSON.stringify(dealsResponse)}`);
        continue;
      }
      
      // Type assertion to work with the response safely
      const typedResponse = dealsResponse as { 
        total?: number; 
        results?: any[]; 
        paging?: { next?: { after?: string } } 
      };
      
      logger.info(`Found ${typedResponse.total || 0} total ${type} deals, fetched ${typedResponse.results?.length || 0} in this batch`);
      
      if (typedResponse.results?.length) {
        totalDeals += typedResponse.results.length;
        
        // Get the batch of deals to process
        let dealBatch = typedResponse.results;
        
        // Explicit log of batch retrieval
        logger.info(`BATCH TRACKING: Retrieved batch of ${dealBatch.length} deals for processing`);
        
        // Collect deal amounts for statistics before filtering
        logger.info(`BATCH TRACKING: Processing ${dealBatch.length} deals for amount statistics`);
        let amountsCollected = 0;
        let amountsBefore = dealAmounts.length;
        
        dealBatch.forEach(deal => {
          if (deal.properties?.amount) {
            const amount = parseFloat(deal.properties.amount);
            if (!isNaN(amount) && amount > 0) {
              dealAmounts.push(amount);
              amountsCollected++;
              logger.info(`AMOUNTS: Added deal amount ${amount} for deal ${deal.id} (${amountsCollected} collected so far)`);
            } else {
              logger.info(`AMOUNTS: Deal ${deal.id} has invalid amount: ${deal.properties.amount}`);
            }
          } else {
            logger.info(`AMOUNTS: Deal ${deal.id} has no amount property`);
          }
        });
        
        logger.info(`AMOUNTS SUMMARY: Total amount array length: ${dealAmounts.length}, Added this batch: ${amountsCollected}, Previous total: ${amountsBefore}`);
        
        // Get the deal IDs from this batch
        const batchDealIds = dealBatch.map(deal => deal.id.toString());
        logger.info(`Fetched ${batchDealIds.length} deals in this batch for ${namespace}, checking which ones need updating`);
        
        // Fetch existing vectors for just these deals using the correct namespace
        try {
          const existingVectors = await getExistingVectors(pineconeClient, batchDealIds, namespace);
          
          if (existingVectors.length > 0) {
            logger.info(`Found ${existingVectors.length} existing vectors in namespace ${namespace}, filtering deals`);
            
            // Filter to only deals that need updating using our enhanced function
            dealBatch = filterVectorsToUpdate(dealBatch, existingVectors);
            logger.info(`After filtering: ${dealBatch.length} out of ${typedResponse.results.length} deals need updating`);
          } else {
            logger.info(`No existing vectors found in namespace ${namespace}, will process all deals`);
          }
        } catch (filterError) {
          logger.error(`Error filtering vectors to update for ${namespace}: ${filterError.message}`);
          // Continue with all deals if filtering fails
        }
        
        // Skip further processing if no deals need updating
        if (dealBatch.length === 0) {
          logger.info(`All deals in this batch already exist in Pinecone, skipping processing`);
          continue;
        }
        
        // Process each deal in this filtered batch individually
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
        
        // Increment batch counter
        batchCount++;

        logger.info(`dealAmounts length: ${dealAmounts.length}`);
        
        // Update the statistics after each batch of deals rather than waiting
        if (dealAmounts.length > 0) {
          try {
            const currentStats = calculateDealStatistics(dealAmounts);
            logger.info(`BATCH TRACKING: Updating incremental statistics for ${type} deals after batch ${batchCount}:`, currentStats);
            
            // Prepare update data for this deal type
            const statUpdateData: any = {
              last_training_date: new Date().toISOString()
            };
            
            // Add the right fields based on deal type
            if (type === 'ideal') {
              statUpdateData.ideal_low = currentStats.low;
              statUpdateData.ideal_high = currentStats.high;
              statUpdateData.ideal_median = currentStats.median;
              statUpdateData.ideal_count = currentStats.count;
              statUpdateData.ideal_last_trained = new Date().toISOString();
              statUpdateData.current_ideal_deals = processedDeals;
            } else {
              statUpdateData.nonideal_low = currentStats.low;
              statUpdateData.nonideal_high = currentStats.high;
              statUpdateData.nonideal_median = currentStats.median;
              statUpdateData.nonideal_count = currentStats.count;
              statUpdateData.nonideal_last_trained = new Date().toISOString();
              statUpdateData.current_less_ideal_deals = processedDeals;
            }
            
            // Log detailed information about the update
            logger.info(`INCREMENTAL UPDATE: Starting database update for ${type} deals (${batchCount} batches)`);
            logger.info(`INCREMENTAL UPDATE: Portal ID: ${portalId}`);
            logger.info(`INCREMENTAL UPDATE: Update data:`, JSON.stringify(statUpdateData, null, 2));
            
            // Make sure supabase is valid
            if (!supabase) {
              logger.error(`INCREMENTAL UPDATE: Supabase client is null or undefined. Cannot update database.`);
              throw new Error('Supabase client is not available for incremental update');
            }
            
            // Update the database with detailed logging
            try {
              logger.info(`INCREMENTAL UPDATE: Executing query to table 'hubspot_accounts' for portal ${portalId}`);
              const updateResult = await supabase
                .from('hubspot_accounts')
                .update(statUpdateData)
                .eq('portal_id', portalId);
              
              logger.info(`INCREMENTAL UPDATE: Query completed. Response:`, JSON.stringify(updateResult, null, 2));
              
              if (updateResult.error) {
                logger.error(`INCREMENTAL UPDATE: Error in database update for ${type} deals:`, updateResult.error);
                throw updateResult.error;
              } else {
                logger.info(`INCREMENTAL UPDATE: Successfully updated ${type} statistics incrementally`);
                
                // Log the actual values that should have been updated
                logger.info(`INCREMENTAL UPDATE: Updated ${type} stats:`, {
                  ...(type === 'ideal' ? {
                    ideal_low: currentStats.low,
                    ideal_high: currentStats.high,
                    ideal_median: currentStats.median,
                    ideal_count: currentStats.count
                  } : {
                    nonideal_low: currentStats.low,
                    nonideal_high: currentStats.high,
                    nonideal_median: currentStats.median,
                    nonideal_count: currentStats.count
                  })
                });
              }
            } catch (dbError) {
              logger.error(`INCREMENTAL UPDATE: Exception during database update:`, dbError);
              throw dbError;
            }
          } catch (statsError) {
            logger.error(`INCREMENTAL UPDATE: Error calculating or updating incremental statistics:`, statsError);
          }
        } else {
          logger.info(`BATCH TRACKING: Skipping statistics update because dealAmounts is empty (length: ${dealAmounts.length})`);
        }
        
        await sleep(5000); // Rate limiting between batches
      }

      // Check if more pages are available
      hasMore = typedResponse.paging?.next?.after !== undefined;
      after = typedResponse.paging?.next?.after || null;

      if (hasMore) {
        logger.info(`More deals available, continuing with after=${after}`);
      }
    }

    // One final statistics update at the end if needed
    if (dealAmounts.length > 0 && batchCount % batchSize !== 0) {
      try {
        const finalStats = calculateDealStatistics(dealAmounts);
        logger.info(`Updating final statistics for ${type} deals:`, finalStats);
        
        // Prepare update data for this deal type
        const finalUpdateData: any = {};
        
        // Add the right fields based on deal type
        if (type === 'ideal') {
          finalUpdateData.ideal_low = finalStats.low;
          finalUpdateData.ideal_high = finalStats.high;
          finalUpdateData.ideal_median = finalStats.median;
          finalUpdateData.ideal_count = finalStats.count;
          finalUpdateData.ideal_last_trained = new Date().toISOString();
          finalUpdateData.current_ideal_deals = processedDeals;
        } else {
          finalUpdateData.nonideal_low = finalStats.low;
          finalUpdateData.nonideal_high = finalStats.high;
          finalUpdateData.nonideal_median = finalStats.median;
          finalUpdateData.nonideal_count = finalStats.count;
          finalUpdateData.nonideal_last_trained = new Date().toISOString();
          finalUpdateData.current_less_ideal_deals = processedDeals;
        }
        
        // Log detailed information about the update
        logger.info(`FINAL UPDATE: Starting database update for ${type} deals`);
        logger.info(`FINAL UPDATE: Portal ID: ${portalId}`);
        logger.info(`FINAL UPDATE: Update data:`, JSON.stringify(finalUpdateData, null, 2));
        
        // Make sure supabase is valid
        if (!supabase) {
          logger.error(`FINAL UPDATE: Supabase client is null or undefined. Cannot update database.`);
          throw new Error('Supabase client is not available for final update');
        }
        
        // Update the database with detailed logging
        try {
          logger.info(`FINAL UPDATE: Executing query to table 'hubspot_accounts' for portal ${portalId}`);
          const updateResult = await supabase
            .from('hubspot_accounts')
            .update(finalUpdateData)
            .eq('portal_id', portalId);
          
          logger.info(`FINAL UPDATE: Query completed. Response:`, JSON.stringify(updateResult, null, 2));
          
          if (updateResult.error) {
            logger.error(`FINAL UPDATE: Error in database update for ${type} deals:`, updateResult.error);
            throw updateResult.error;
          } else {
            logger.info(`FINAL UPDATE: Successfully updated ${type} statistics with final values`);
            
            // Log the actual values that should have been updated
            logger.info(`FINAL UPDATE: Updated ${type} stats:`, {
              ...(type === 'ideal' ? {
                ideal_low: finalStats.low,
                ideal_high: finalStats.high,
                ideal_median: finalStats.median,
                ideal_count: finalStats.count
              } : {
                nonideal_low: finalStats.low,
                nonideal_high: finalStats.high,
                nonideal_median: finalStats.median,
                nonideal_count: finalStats.count
              })
            });
          }
        } catch (dbError) {
          logger.error(`FINAL UPDATE: Exception during database update:`, dbError);
          throw dbError;
        }
      } catch (statsError) {
        logger.error(`FINAL UPDATE: Error calculating or updating final statistics:`, statsError);
      }
    }

    logger.info(`Completed processing ${type} deals: ${processedDeals}/${totalDeals}`);
    logger.info(`Collected ${dealAmounts.length} deal amounts for statistics`);
    return { total: totalDeals, processed: processedDeals, dealAmounts };
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
  
  logger.info(`Processing deal ${deal.id} (${classification}) in namespace ${namespace}`);
  
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
 * Get existing vectors for a list of deal IDs
 */
async function getExistingVectors(
  pineconeClient: PineconeClient,
  dealIds: string[],
  namespace: string
): Promise<any[]> {
  try {
    logger.info(`Fetching existing vectors for ${dealIds.length} deals from namespace ${namespace}`);
    logger.info(`Deal IDs to check: ${dealIds.join(', ')}`);
    
    if (!dealIds.length) {
      logger.info('No deal IDs provided, returning empty array');
      return [];
    }
    
    // Get index host and API key from environment
    const pineconeIndexHost = Deno.env.get('PINECONE_INDEX_HOST');
    const pineconeApiKey = Deno.env.get('PINECONE_API_KEY');
    
    if (!pineconeIndexHost || !pineconeApiKey) {
      logger.error('Missing PINECONE_INDEX_HOST or PINECONE_API_KEY environment variables');
      return [];
    }
    
    // Use direct fetchByIds method which is more reliable than query
    try {
      logger.info(`Trying direct fetch by IDs for ${dealIds.length} deals in namespace: ${namespace}`);
      const fetchResult = await pineconeClient.fetchByIds(
        dealIds.map(id => id.toString()), 
        namespace,
        pineconeIndexHost,
        pineconeApiKey
      );
      
      logger.info(`Direct fetch result structure: ${JSON.stringify(Object.keys(fetchResult))}`);
      
      // Check for matches property (pineconeClient.fetchByIds returns matches, not vectors)
      if (fetchResult.matches && fetchResult.matches.length > 0) {
        logger.info(`Found ${fetchResult.matches.length} vectors with IDs: ${fetchResult.matches.map(m => m.id).join(', ')}`);
        
        // Log more details about what we found
        if (fetchResult.matches[0].metadata) {
          logger.info(`Vector sample metadata keys: ${Object.keys(fetchResult.matches[0].metadata || {}).join(', ')}`);
        }
        
        // Return the matches directly since they're already in the format we need
        logger.info(`Successfully found ${fetchResult.matches.length} vectors from result`);
        return fetchResult.matches;
      }
      
      logger.info('No matching vectors found with direct fetch');
      return [];
    } catch (fetchError) {
      logger.error(`Error fetching vectors by ID: ${fetchError.message}`);
      return [];
    }
  } catch (error) {
    logger.error(`Error getting existing vectors: ${error.message}`);
    return [];
  }
}

/**
 * Calculates statistics for deal amounts
 */
function calculateDealStatistics(dealAmounts: number[]): {
  low: number;
  high: number;
  median: number;
  count: number;
} {
  if (!dealAmounts.length) {
    return { low: 0, high: 0, median: 0, count: 0 };
  }
  
  // Sort the deal amounts for calculating median
  const sortedAmounts = [...dealAmounts].sort((a, b) => a - b);
  
  const low = sortedAmounts[0];
  const high = sortedAmounts[sortedAmounts.length - 1];
  
  // Calculate median
  let median: number;
  const mid = Math.floor(sortedAmounts.length / 2);
  
  if (sortedAmounts.length % 2 === 0) {
    // Even number of amounts
    median = (sortedAmounts[mid - 1] + sortedAmounts[mid]) / 2;
  } else {
    // Odd number of amounts
    median = sortedAmounts[mid];
  }
  
  return {
    low,
    high,
    median,
    count: dealAmounts.length
  };
}

/**
 * Main handler for the edge function
 */
serve(async (req) => {
  try {
    logger.info('Starting hubspot-auto-training');
    
    // Get URL parameters
    const url = new URL(req.url);
    const portal_id = url.searchParams.get('portal_id');
    const deal_type = url.searchParams.get('deal_type');
    
    // Validate deal_type if provided
    if (deal_type && !['ideal', 'nonideal'].includes(deal_type)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid deal_type parameter. Must be 'ideal' or 'nonideal'."
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        }
      );
    }
    
    if (portal_id) {
      logger.info(`Portal ID specified: ${portal_id}, will only process this portal`);
    } else {
      logger.info('No portal ID specified, will process all portals');
    }
    
    if (deal_type) {
      logger.info(`Deal type specified: ${deal_type}, will only process ${deal_type} deals`);
    } else {
      logger.info('No deal type specified, will process both ideal and nonideal deals');
    }
    
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
        
        // Ensure supabase client is available and log it
        if (!supabase) {
          logger.error(`Supabase client is null or undefined. This will cause database update failures.`);
        } else {
          logger.info(`Supabase client is available for database updates.`);
          
          // Test the database connection with a simple query
          try {
            logger.info(`Testing database connection for portal ${portalId}`);
            const { data: testData, error: testError } = await supabase
              .from('hubspot_accounts')
              .select('id, portal_id, ideal_low, ideal_high, ideal_median, nonideal_low, nonideal_high, nonideal_median')
              .eq('portal_id', portalId)
              .limit(1);
            
            if (testError) {
              logger.error(`Database test query failed: ${testError.message}`, testError);
            } else if (testData && testData.length > 0) {
              logger.info(`Database test query successful. Found record with ID ${testData[0].id}`);
              // Log the current values of the statistics fields to verify schema
              logger.info(`Current statistics values in database:`, {
                ideal_low: testData[0].ideal_low,
                ideal_high: testData[0].ideal_high,
                ideal_median: testData[0].ideal_median,
                nonideal_low: testData[0].nonideal_low,
                nonideal_high: testData[0].nonideal_high,
                nonideal_median: testData[0].nonideal_median
              });
            } else {
              logger.warn(`Database test query returned no results for portal ${portalId}`);
            }
          } catch (dbTestError) {
            logger.error(`Exception during database test: ${dbTestError.message}`);
          }
        }
        
        // Validate token
        logger.info(`Validating token for portal ${portalId}`);
        await handleApiCall(hubspotClient, portalId, decryptedRefreshToken, () => 
          hubspotClient.searchRecords('contacts', { limit: 1 })
        );
        
        // Track portal results
        const portalResult = {
          portalId,
          ideal: { 
            total: 0, 
            processed: 0,
            stats: null as { low: number; high: number; median: number; count: number } | null
          },
          nonideal: { 
            total: 0, 
            processed: 0,
            stats: null as { low: number; high: number; median: number; count: number } | null
          }
        };
        
        // Process ideal deals if no deal_type is specified or deal_type is 'ideal'
        if (!deal_type || deal_type === 'ideal') {
          try {
            logger.info(`Starting ideal deals processing for portal ${portalId}`);
            
            const idealDeals = await getDealsForTraining(hubspotClient, 'ideal', portalId, decryptedRefreshToken, documentPackager, openai, pineconeClient, supabase);
            
            portalResult.ideal.total = idealDeals.total;
            portalResult.ideal.processed = idealDeals.processed;
            
            // Calculate statistics for ideal deals
            const idealStats = calculateDealStatistics(idealDeals.dealAmounts);
            logger.info(`Ideal deal statistics - Count: ${idealStats.count}, Low: ${idealStats.low}, High: ${idealStats.high}, Median: ${idealStats.median}`);
            
            // Store the statistics for later database update
            portalResult.ideal.stats = idealStats;
            
            logger.info(`Processed ${idealDeals.processed} ideal deals for portal ${portalId}`);
            
          } catch (idealDealsError) {
            logger.error(`Error processing ideal deals for portal ${portalId}: ${idealDealsError.message}`);
          }
        }
        
        // Process non-ideal deals if no deal_type is specified or deal_type is 'nonideal'
        if (!deal_type || deal_type === 'nonideal') {
          try {
            logger.info(`Starting non-ideal deals processing for portal ${portalId}`);
            
            const nonIdealDeals = await getDealsForTraining(hubspotClient, 'nonideal', portalId, decryptedRefreshToken, documentPackager, openai, pineconeClient, supabase);
            
            portalResult.nonideal.total = nonIdealDeals.total;
            portalResult.nonideal.processed = nonIdealDeals.processed;
            
            // Calculate statistics for non-ideal deals
            const nonIdealStats = calculateDealStatistics(nonIdealDeals.dealAmounts);
            logger.info(`Non-ideal deal statistics - Count: ${nonIdealStats.count}, Low: ${nonIdealStats.low}, High: ${nonIdealStats.high}, Median: ${nonIdealStats.median}`);
            
            // Store the statistics for later database update
            portalResult.nonideal.stats = nonIdealStats;
            
            logger.info(`Processed ${nonIdealDeals.processed} non-ideal deals for portal ${portalId}`);
          } catch (nonIdealDealsError) {
            logger.error(`Error processing non-ideal deals for portal ${portalId}: ${nonIdealDealsError.message}`);
          }
        }
        
        // Update database with metrics - only update the counts for the deal types that were processed
        const updateData: any = {
          last_training_date: new Date().toISOString()
        };

        // Check and log stats availability
        logger.info(`Checking ideal stats for portal ${portalId}`);
        logger.info(`deal_type: ${deal_type || 'both'}, has ideal stats: ${portalResult.ideal.stats !== null}`);
        if (portalResult.ideal.stats) {
          logger.info(`Ideal stats details - Count: ${portalResult.ideal.stats.count}, Low: ${portalResult.ideal.stats.low}, High: ${portalResult.ideal.stats.high}, Median: ${portalResult.ideal.stats.median}`);
        }

        // Update ideal deal metrics if processed
        if ((!deal_type || deal_type === 'ideal') && portalResult.ideal.stats) {
          logger.info(`Adding ideal stats to updateData`);
          updateData.current_ideal_deals = portalResult.ideal.processed;
          updateData.ideal_low = portalResult.ideal.stats.low;
          updateData.ideal_high = portalResult.ideal.stats.high;
          updateData.ideal_median = portalResult.ideal.stats.median;
          updateData.ideal_count = portalResult.ideal.stats.count;
          updateData.ideal_last_trained = new Date().toISOString();
        } else {
          logger.info(`Skipping ideal stats update: condition not met`);
          if (deal_type && deal_type !== 'ideal') {
            logger.info(`Reason: deal_type is ${deal_type}, not 'ideal'`);
          }
          if (!portalResult.ideal.stats) {
            logger.info(`Reason: portalResult.ideal.stats is null`);
          }
        }

        // Check and log stats availability for non-ideal
        logger.info(`Checking non-ideal stats for portal ${portalId}`);
        logger.info(`deal_type: ${deal_type || 'both'}, has non-ideal stats: ${portalResult.nonideal.stats !== null}`);
        if (portalResult.nonideal.stats) {
          logger.info(`Non-ideal stats details - Count: ${portalResult.nonideal.stats.count}, Low: ${portalResult.nonideal.stats.low}, High: ${portalResult.nonideal.stats.high}, Median: ${portalResult.nonideal.stats.median}`);
        }

        // Update non-ideal deal metrics if processed
        if ((!deal_type || deal_type === 'nonideal') && portalResult.nonideal.stats) {
          logger.info(`Adding non-ideal stats to updateData`);
          updateData.current_less_ideal_deals = portalResult.nonideal.processed;
          updateData.nonideal_low = portalResult.nonideal.stats.low;
          updateData.nonideal_high = portalResult.nonideal.stats.high;
          updateData.nonideal_median = portalResult.nonideal.stats.median;
          updateData.nonideal_count = portalResult.nonideal.stats.count;
          updateData.nonideal_last_trained = new Date().toISOString();
        } else {
          logger.info(`Skipping non-ideal stats update: condition not met`);
          if (deal_type && deal_type !== 'nonideal') {
            logger.info(`Reason: deal_type is ${deal_type}, not 'nonideal'`);
          }
          if (!portalResult.nonideal.stats) {
            logger.info(`Reason: portalResult.nonideal.stats is null`);
          }
        }

        // Log the update data for debugging
        logger.info(`Attempting to update database for portal ${portalId} with data:`, JSON.stringify(updateData, null, 2));
        
        // Additional debug logging
        logger.info('Update data keys:', Object.keys(updateData));
        logger.info('Ideal data fields:', {
          ideal_low: updateData.ideal_low,
          ideal_high: updateData.ideal_high,
          ideal_median: updateData.ideal_median,
          ideal_count: updateData.ideal_count
        });
        logger.info('Nonideal data fields:', {
          nonideal_low: updateData.nonideal_low,
          nonideal_high: updateData.nonideal_high,
          nonideal_median: updateData.nonideal_median,
          nonideal_count: updateData.nonideal_count
        });

        try {
          const { data: updateResult, error: updateError } = await supabase
            .from('hubspot_accounts')
            .update(updateData)
            .eq('portal_id', portalId);
          
          if (updateError) {
            logger.error(`Database update error for portal ${portalId}:`, updateError);
          } else {
            logger.info(`Successfully updated database for portal ${portalId}`);
          }
        } catch (dbError) {
          logger.error(`Exception during database update for portal ${portalId}:`, dbError);
        }
        
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
        deal_type: deal_type || 'both',
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