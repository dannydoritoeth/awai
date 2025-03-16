import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Pinecone } from 'https://esm.sh/@pinecone-database/pinecone@1.1.0';
import OpenAI from 'https://esm.sh/openai@4.20.1';
import { HubspotClient } from '../_shared/hubspotClient.ts';
import { Logger } from '../_shared/logger.ts';

const logger = new Logger('process-ideal-clients');

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

    const { data: account, error: accountError } = await supabase
      .from('hubspot_accounts')
      .select('*')
      .eq('portal_id', portalId)
      .single();

    if (accountError) {
      logger.error('Error fetching account from Supabase:', accountError);
      throw new Error(`Failed to fetch account: ${accountError.message}`);
    }

    if (!account) {
      throw new Error(`No account found for portal ${portalId}`);
    }

    logger.info('Initializing clients');
    const hubspotClient = new HubspotClient(account.access_token);

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
    const searchResults = await hubspotClient.searchRecords(type, {
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

        // Get embeddings using OpenAI directly
        logger.info(`Generating embeddings for record ${record.id}`);
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-large',
          input: JSON.stringify(trainingData)
        });

        const embedding = embeddingResponse.data[0].embedding;

        // Store in Pinecone
        logger.info(`Storing embeddings for record ${record.id} in Pinecone`);
        await pineconeIndex.upsert({
          vectors: [{
            id: record.id,
            values: embedding,
            metadata: trainingData
          }],
          namespace: type // Use record type as namespace
        });

        results.successful++;
        logger.info(`Successfully processed record ${record.id}`);
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