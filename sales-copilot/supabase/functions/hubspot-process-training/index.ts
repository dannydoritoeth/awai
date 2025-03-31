import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Pinecone } from 'https://esm.sh/@pinecone-database/pinecone@5.1.1';
import OpenAI from 'https://esm.sh/openai@4.86.1';
import { HubspotClient } from '../_shared/hubspotClient.ts';
import { Logger } from '../_shared/logger.ts';
import { decrypt, encrypt } from '../_shared/encryption.ts';
import { DocumentPackager } from '../_shared/documentPackager.ts';

const logger = new Logger('process-ideal-clients');

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

async function processRecords(records: any[], type: string, portalId: string, hubspotClient: HubspotClient, shouldClearNamespace: boolean = false) {
  const logger = new Logger('processRecords');
  logger.info(`Processing ${records.length} ${type} records for portal ${portalId}`);

  const pinecone = new Pinecone({
    apiKey: Deno.env.get('PINECONE_API_KEY') || '',
  });

  const pineconeIndex = pinecone.index(Deno.env.get('PINECONE_INDEX') || 'sales-copilot');
  const namespace = `hubspot-${portalId}`;

  // Delete all existing vectors in the namespace if this is the first record type
  if (shouldClearNamespace) {
    try {
      logger.info(`Attempting to delete existing vectors in namespace: ${namespace}`);
      await pineconeIndex.deleteAll({ namespace });
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

  const openai = new OpenAI({
    apiKey: Deno.env.get('OPENAI_API_KEY') || ''
  });

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

  // Prepare vectors for Pinecone
  const vectors = documents.map((doc, i) => ({
    id: doc.metadata.id.toString(),
    values: embeddingResponse.data[i].embedding,
    metadata: {
      ...doc.metadata
    }
  }));

  logger.info(`Upserting ${vectors.length} vectors to Pinecone`);
  logger.info('Pinecone config:', {
    apiKey: Deno.env.get('PINECONE_API_KEY')?.slice(0, 5) + '...',
    indexName: Deno.env.get('PINECONE_INDEX') || 'sales-copilot',
    namespace
  });

  // Upsert to Pinecone - update format for v5.1.1
  await pineconeIndex.upsert([{
    id: vectors[0].id,
    values: vectors[0].values,
    metadata: vectors[0].metadata
  }]);

  // Upsert remaining vectors in batches of 100
  for (let i = 1; i < vectors.length; i += 100) {
    const batch = vectors.slice(i, i + 100).map(vector => ({
      id: vector.id,
      values: vector.values,
      metadata: vector.metadata
    }));
    await pineconeIndex.upsert(batch);
    logger.info(`Upserted batch of ${batch.length} vectors`);
  }

  logger.info(`Successfully added ${vectors.length} documents to Pinecone`);
  return vectors.length;
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

        // Check if token is expired or will expire soon (within 5 minutes)
        const expiresAt = new Date(account.expires_at);
        const now = new Date();
        const fiveMinutes = 5 * 60 * 1000;
        
        // Try to make a test request to validate the token
        try {
          await hubspotClient.searchRecords('contacts', { limit: 1 });
        } catch (error) {
          if (error.message.includes('expired')) {
            logger.info(`Token validation failed for portal ${portalId}, refreshing...`);
            const newTokens = await refreshHubSpotToken(decryptedRefreshToken);
            
            // Encrypt new tokens
            const newEncryptedToken = await encrypt(newTokens.access_token, Deno.env.get('ENCRYPTION_KEY')!);
            const newEncryptedRefreshToken = await encrypt(newTokens.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);
            
            // Update tokens in database
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
              throw new Error('Failed to update HubSpot tokens');
            }
            
            // Update the client with the new token
            decryptedToken = newTokens.access_token;
            hubspotClient.updateToken(newTokens.access_token);
            logger.info('Successfully refreshed and updated tokens');
          } else {
            throw error;
          }
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
            const searchResponse = await hubspotClient.searchRecords(type, {
              limit: 100
            });

            if (searchResponse.total > 0) {
              portalResults[type].processed = searchResponse.total;
              await processRecords(searchResponse.results, type, portalId.toString(), hubspotClient, type === 'contacts');
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