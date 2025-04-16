import { Logger } from './logger.ts';
import { DocumentPackager } from './documentPackager.ts';
import { PineconeClient } from './pineconeClient.ts';
import { HubspotClient } from './hubspotClient.ts';
import { handleApiCall } from './apiHandler.ts';
import { sleep } from './utils.ts';
import { calculateConversionDays } from './statistics.ts';
import { SubscriptionService } from './subscriptionService.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const logger = new Logger('dealProcessor');

/**
 * Process a single deal including its associations
 */
export async function processSingleDeal(
  deal: any,
  classification: string,
  hubspotClient: HubspotClient,
  documentPackager: DocumentPackager,
  openai: any,
  pineconeClient: PineconeClient,
  portalId: string,
  namespace: string,
  refreshToken?: string // Add refresh token parameter for API call handling
): Promise<void> {
  const processingStart = Date.now();
  
  logger.info(`Processing deal ${deal.id} (${classification}) in namespace ${namespace}`);
  
  try {
    // Initialize subscription service
    const subscriptionService = new SubscriptionService(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // First, check if this deal is already in Pinecone with the same metadata
    try {
      const dealVectorId = `deal-${portalId}-${deal.id}`;
      logger.info(`Checking if deal ${deal.id} already exists in Pinecone`);
      
      const fetchResult = await pineconeClient.query(namespace, null, dealVectorId, 1);
      
      if (fetchResult.matches && fetchResult.matches.length > 0) {
        const existingVector = fetchResult.matches[0];
        
        // Check if deal metadata is the same
        const currentValue = parseFloat(deal.properties?.amount) || 0;
        const currentPipeline = deal.properties?.pipeline || 'unknown';
        const currentDealstage = deal.properties?.dealstage || 'unknown';
        const currentDaysInPipeline = parseInt(deal.properties?.hs_time_in_pipeline) || 0;
        
        // Compare with existing metadata
        if (existingVector.metadata && 
            existingVector.metadata.deal_value === currentValue &&
            existingVector.metadata.pipeline === currentPipeline &&
            existingVector.metadata.dealstage === currentDealstage) {
          
          logger.info(`Deal ${deal.id} already exists in Pinecone with the same metadata. Skipping processing.`);
          return; // Skip processing this deal
        } else {
          logger.info(`Deal ${deal.id} exists but metadata has changed. Will update.`);
        }
      } else {
        logger.info(`Deal ${deal.id} not found in Pinecone. Will process.`);
      }
    } catch (checkError) {
      logger.warn(`Error checking if deal exists: ${checkError.message}. Will proceed with processing.`);
    }
    
    // Get all contacts and companies associated with this deal
    try {
      // Check if we have refresh token for API call handling
      let associationsResult;
      if (refreshToken) {
        associationsResult = await handleApiCall(
          hubspotClient,
          portalId,
          refreshToken,
          () => hubspotClient.getAssociations(deal.id, 'deal')
        );
      } else {
        associationsResult = await hubspotClient.getAssociations(deal.id, 'deal');
      }
      
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
    
    // Get associated records
    const associatedRecords = {
      contacts: [] as any[],
      companies: [] as any[]
    };

    // Fetch associated contacts
    if (deal.associations?.contacts?.results) {
      for (const contact of deal.associations.contacts.results) {
        try {
          let contactRecord;
          if (refreshToken) {
            contactRecord = await handleApiCall(
              hubspotClient,
              portalId,
              refreshToken,
              () => hubspotClient.getContact(contact.id)
            );
          } else {
            contactRecord = await hubspotClient.getContact(contact.id);
          }
          
          if (contactRecord) {
            associatedRecords.contacts.push(contactRecord);
          }
        } catch (error) {
          logger.error(`Error fetching contact ${contact.id}: ${error.message}`);
        }
      }
    }

    // Fetch associated companies
    if (deal.associations?.companies?.results) {
      for (const company of deal.associations.companies.results) {
        try {
          let companyRecord;
          if (refreshToken) {
            companyRecord = await handleApiCall(
              hubspotClient,
              portalId,
              refreshToken,
              () => hubspotClient.getCompany(company.id)
            );
          } else {
            companyRecord = await hubspotClient.getCompany(company.id);
          }
          
          if (companyRecord) {
            associatedRecords.companies.push(companyRecord);
          }
        } catch (error) {
          logger.error(`Error fetching company ${company.id}: ${error.message}`);
        }
      }
    }
    
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
    
    // Record training event before generating embeddings
    await subscriptionService.recordTrainingEvent(
      portalId,
      'deal',
      deal.id,
      classification,
      {
        dealDocuments,
        contactDocuments,
        companyDocuments,
        dealMetadata
      }
    );
    
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
      logger.info(`Checking if ${vectorIds.length} vectors already exist in namespace ${namespace}`);
      try {
        // Fetch existing vectors in batches (limit by Pinecone API)
        const batchSize = 100;
        const existingVectors = new Map();
        
        for (let i = 0; i < vectorIds.length; i += batchSize) {
          const batchIds = vectorIds.slice(i, i + batchSize);
          
          try {
            logger.info(`Querying for batch of ${batchIds.length} vectors`);
            const fetchResult = await pineconeClient.query(namespace, null, { id: { $in: batchIds } }, batchIds.length);
            
            if (fetchResult.matches?.length > 0) {
              // Store existing vectors to compare later
              logger.info(`Found ${fetchResult.matches.length} existing vectors`);
              fetchResult.matches.forEach(vector => {
                existingVectors.set(vector.id, {
                  metadata: vector.metadata
                });
              });
            } else {
              logger.info(`No matching vectors found in this batch`);
            }
          } catch (fetchBatchError) {
            logger.error(`Error fetching batch of vectors: ${fetchBatchError.message}`);
            // Continue with next batch
          }
        }

        logger.info(`Total existing vectors found: ${existingVectors.size}`);
        
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