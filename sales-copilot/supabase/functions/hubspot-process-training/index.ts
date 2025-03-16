import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Pinecone } from 'https://esm.sh/@pinecone-database/pinecone@1.1.0';
import OpenAI from 'https://esm.sh/openai@4.20.1';
import { Document } from "npm:langchain/document";
import { OpenAIEmbeddings } from "npm:langchain/embeddings/openai";
import { PineconeStore } from "npm:langchain/vectorstores/pinecone";
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

    const { portalId, type = 'contacts' } = body;
    logger.info(`Processing portal ${portalId} for type ${type}`);
    
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

    // Initialize Pinecone
    logger.info(`Initializing Pinecone with index ${portalId}`);
    const pinecone = new Pinecone({
      apiKey: Deno.env.get('PINECONE_API_KEY')!,
      environment: Deno.env.get('PINECONE_ENVIRONMENT')!
    });

    const pineconeIndex = pinecone.Index(portalId);

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY')!
    });

    // Search for classified records
    logger.info('Searching for classified records in HubSpot');
    const recordType = type === 'contacts' ? 'contact' : 'company';
    const searchResults = await hubspotClient.searchRecords(recordType, {
      filterGroups: [{
        filters: [{
          propertyName: 'training_classification',
          operator: 'IN',
          values: ['ideal', 'less_ideal']
        }]
      }],
      properties: [
        'training_classification',
        'training_attributes',
        'training_score',
        'training_notes',
        // Add other relevant properties based on record type
        ...(type === 'contacts' ? [
          'firstname',
          'lastname',
          'email',
          'company',
          'industry',
          'jobtitle'
        ] : [
          'name',
          'industry',
          'type',
          'description',
          'numberofemployees'
        ])
      ],
      limit: 100
    });

    logger.info(`Found ${searchResults.results.length} classified ${type}`);

    // Process each record
    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [] as any[]
    };

    // Initialize OpenAI embeddings
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: Deno.env.get('OPENAI_API_KEY')!,
      modelName: 'text-embedding-3-large'
    });

    // Prepare documents for batch processing
    const documents: Document[] = [];

    for (const record of searchResults.results) {
      try {
        logger.info(`Processing record ${record.id} (${results.processed + 1}/${searchResults.results.length})`);
        results.processed++;

        // Get selected attributes
        const attributes = record.properties.training_attributes?.split(';') || [];
        const score = parseFloat(record.properties.training_score) || null;

        if (!score) {
          logger.warn(`No training score found for record ${record.id}`);
        }

        // Create training data object
        const trainingData = {
          id: record.id,
          type,
          properties: record.properties,
          classification: record.properties.training_classification,
          score,
          attributes,
          notes: record.properties.training_notes,
          metadata: {
            isTrainingData: true,
            classification: record.properties.training_classification,
            score,
            attributes,
            recordType: type
          }
        };

        // Create LangChain document
        const doc = new Document({
          pageContent: JSON.stringify(trainingData),
          metadata: {
            id: record.id,
            source: 'hubspot',
            type,
            ...trainingData.metadata
          }
        });

        documents.push(doc);
        results.successful++;
        logger.info(`Successfully prepared document for record ${record.id}`);
      } catch (error) {
        results.failed++;
        const errorDetails = {
          recordId: record.id,
          error: error.message,
          stack: error.stack,
          properties: record.properties
        };
        results.errors.push(errorDetails);
        logger.error(`Error processing record ${record.id}:`, errorDetails);
      }
    }

    if (documents.length > 0) {
      try {
        logger.info(`Adding ${documents.length} documents to Pinecone`);
        
        // Create Pinecone store with namespace
        await PineconeStore.fromDocuments(
          documents,
          embeddings,
          {
            pineconeIndex: pineconeIndex,
            namespace: type,
            textKey: 'pageContent'
          }
        );

        logger.info('Successfully added documents to Pinecone');
      } catch (error) {
        logger.error('Error adding documents to Pinecone:', error);
        throw error;
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
    logger.error('Error processing ideal clients:', errorDetails);
    return new Response(
      JSON.stringify({ error: error.message, details: errorDetails }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}); 