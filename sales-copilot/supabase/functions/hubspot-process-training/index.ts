import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Pinecone } from 'https://esm.sh/@pinecone-database/pinecone@5.1.1';
import OpenAI from 'https://esm.sh/openai@4.86.1';
import { HubspotClient } from '../_shared/hubspotClient.ts';
import { Logger } from '../_shared/logger.ts';
import { decrypt, encrypt } from '../_shared/encryption.ts';

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

async function processRecords(records: any[], type: string, portalId: string, shouldClearNamespace: boolean = false) {
  const logger = new Logger('processRecords');
  logger.info(`Processing ${records.length} ${type} records for portal ${portalId}`);

  const pinecone = new Pinecone({
    apiKey: Deno.env.get('PINECONE_API_KEY') || '',
  });

  const pineconeIndex = pinecone.index('sales-copilot');
  const namespace = `hubspot-${portalId}`;

  // Delete all existing vectors in the namespace if this is the first record type
  if (shouldClearNamespace) {
    logger.info(`Deleting existing vectors in namespace: ${namespace}`);
    await pineconeIndex.deleteAll({ namespace });
  }

  const openai = new OpenAI({
    apiKey: Deno.env.get('OPENAI_API_KEY') || ''
  });

  // Create documents with content and metadata
  const documents = records.map(record => {
    const attributes = record.properties.training_attributes?.split(';') || [];
    const score = parseFloat(record.properties.training_score) || null;
    const classification = record.properties.training_classification;
    const notes = record.properties.training_notes;

    const content = [
      `Type: ${type}`,
      `Classification: ${classification}`,
      `Score: ${score}`,
      `Attributes: ${attributes.join(', ')}`,
      `Notes: ${notes}`,
      ...Object.entries(record.properties)
        .filter(([key]) => !key.startsWith('training_'))
        .map(([key, value]) => `${key}: ${value}`)
    ].join('\n');

    const metadata = {
      id: record.id,
      source: type,
      portalId: portalId,
      classification,
      score,
      attributes,
      isTrainingData: true
    };

    logger.info(`Created document for record ${record.id}:`, {
      metadata,
      contentPreview: content.slice(0, 100) + '...'
    });

    return {
      content,
      metadata
    };
  });

  logger.info(`Created ${documents.length} documents`);

  // Get embeddings for all documents using OpenAI directly
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: documents.map(doc => doc.content)
  });

  // Prepare vectors for Pinecone
  const vectors = documents.map((doc, i) => ({
    id: doc.metadata.id.toString(),
    values: embeddingResponse.data[i].embedding,
    metadata: {
      ...doc.metadata,
      text: doc.content
    }
  }));

  logger.info(`Upserting ${vectors.length} vectors to Pinecone`);
  logger.info('Pinecone config:', {
    apiKey: Deno.env.get('PINECONE_API_KEY')?.slice(0, 5) + '...',
    indexName: 'sales-copilot',
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

    // Validate Content-Type
    const contentType = req.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Content-Type must be application/json");
    }

    // Get and validate request body
    let body;
    try {
      const text = await req.text();
      logger.info('Received request body:', text);
      
      if (!text) {
        throw new Error("Request body is empty");
      }
      
      body = JSON.parse(text);
      
      if (!body || typeof body !== 'object') {
        throw new Error("Invalid JSON body");
      }
    } catch (error) {
      throw new Error(`Failed to parse request body: ${error.message}`);
    }

    const { portalId } = body;
    logger.info(`Processing portal ${portalId} for all record types`);
    
    if (!portalId) {
      throw new Error('Portal ID is required');
    }

    // Get the access token from Supabase
    logger.info('Fetching account from Supabase');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Convert portalId to number if it's a string
    const numericPortalId = typeof portalId === 'string' ? parseInt(portalId, 10) : portalId;
    logger.info(`Looking up account for portal ID: ${numericPortalId}`);

    const { data: account, error: accountError } = await supabase
      .from('hubspot_accounts')
      .select('*')
      .eq('portal_id', numericPortalId)
      .single();

    if (accountError) {
      logger.error('Error fetching account from Supabase:', accountError);
      throw new Error(`Failed to fetch account: ${accountError.message}`);
    }

    if (!account) {
      throw new Error(`No account found for portal ${numericPortalId}`);
    }

    // Decrypt tokens
    let decryptedToken = await decrypt(account.access_token, Deno.env.get('ENCRYPTION_KEY')!);
    const decryptedRefreshToken = await decrypt(account.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);
    
    logger.info('Found HubSpot account:', { 
      portalId: account.portal_id,
      hasAccessToken: !!decryptedToken,
      hasRefreshToken: !!decryptedRefreshToken,
      tokenLength: decryptedToken?.length || 0,
      tokenStart: decryptedToken?.substring(0, 5) || 'none',
      expiresAt: account.expires_at
    });

    if (!decryptedToken || !decryptedRefreshToken) {
      throw new Error('HubSpot tokens are missing or invalid. Please reconnect your HubSpot account.');
    }

    // Check if token is expired or will expire soon (within 5 minutes)
    const expiresAt = new Date(account.expires_at);
    const now = new Date();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (expiresAt.getTime() - now.getTime() < fiveMinutes) {
      logger.info('Access token expired or expiring soon, refreshing...');
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
        .eq('portal_id', numericPortalId);
        
      if (updateError) {
        logger.error('Failed to update tokens:', updateError);
        throw new Error('Failed to update HubSpot tokens');
      }
      
      logger.info('Successfully refreshed and updated tokens');
      decryptedToken = newTokens.access_token;
    }

    logger.info('Initializing clients');
    const hubspotClient = new HubspotClient(decryptedToken);

    // Process each record type
    const recordTypes = ['contacts', 'companies', 'deals'];
    const results = {
      contacts: { processed: 0, successful: 0, failed: 0, errors: [] as any[] },
      companies: { processed: 0, successful: 0, failed: 0, errors: [] as any[] },
      deals: { processed: 0, successful: 0, failed: 0, errors: [] as any[] }
    };

    for (const type of recordTypes) {
      logger.info(`Processing ${type}`);
      const recordType = type === 'deals' ? 'deal' : type.slice(0, -1); // Remove 's' for contacts/companies

      // Get properties based on record type
      const properties = [
        'training_classification',
        'training_attributes',
        'training_score',
        'training_notes',
        ...(type === 'contacts' ? [
          'firstname',
          'lastname',
          'email',
          'company',
          'industry',
          'jobtitle'
        ] : type === 'companies' ? [
          'name',
          'industry',
          'type',
          'description',
          'numberofemployees'
        ] : [ // deals
          'dealname',
          'amount',
          'dealstage',
          'pipeline',
          'closedate'
        ])
      ];

      // Search for classified records
      logger.info(`Searching for classified ${type} in HubSpot`);
      const searchResults = await hubspotClient.searchRecords(recordType, {
        filterGroups: [{
          filters: [{
            propertyName: 'training_classification',
            operator: 'IN',
            values: ['ideal', 'less_ideal']
          }]
        }],
        properties,
        limit: 100
      });

      logger.info(`Found ${searchResults.results.length} classified ${type}`);

      if (searchResults.results.length > 0) {
        try {
          logger.info(`Processing ${type} records`);
          // Pass shouldClearNamespace as true only for the first type
          const processedCount = await processRecords(searchResults.results, type, portalId, type === recordTypes[0]);
          results[type].processed = processedCount;
          results[type].successful = processedCount;
          logger.info(`Successfully processed ${type} records`);
        } catch (error) {
          results[type].failed = searchResults.results.length;
          const errorDetails = {
            recordCount: searchResults.results.length,
            error: error.message,
            stack: error.stack,
          };
          results[type].errors.push(errorDetails);
          logger.error(`Error processing ${type} records:`, errorDetails);
        }
      }
    }

    logger.info('Process training completed', results);
    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      cause: error.cause
    };
    logger.error('Error processing training data:', errorDetails);
    return new Response(
      JSON.stringify({ error: error.message, details: errorDetails }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}); 