import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Pinecone } from 'https://esm.sh/@pinecone-database/pinecone@1.1.0';
import OpenAI from 'https://esm.sh/openai@4.20.1';
import { HubspotClient } from '../_shared/hubspotClient.ts';
import { Logger } from '../_shared/logger.ts';

const logger = new Logger('process-ideal-clients');

serve(async (req) => {
  try {
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

    const { portalId, type = 'contacts' } = await req.json();
    
    if (!portalId) {
      throw new Error('Portal ID is required');
    }

    // Get the access token from Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: account, error } = await supabase
      .from('hubspot_accounts')
      .select('*')
      .eq('portal_id', portalId)
      .single();

    if (error || !account) {
      throw new Error(`No account found for portal ${portalId}`);
    }

    const hubspotClient = new HubspotClient(account.access_token);

    // Initialize Pinecone
    const pinecone = new Pinecone({
      apiKey: Deno.env.get('PINECONE_API_KEY')!
    });

    const pineconeIndex = pinecone.Index(Deno.env.get('PINECONE_INDEX_NAME')!);

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY')!
    });

    // Search for classified records
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
      errors: []
    };

    for (const record of searchResults.results) {
      try {
        results.processed++;

        // Get selected attributes
        const attributes = record.properties.training_attributes?.split(';') || [];
        const score = parseFloat(record.properties.training_score) || null;

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
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-large',
          input: JSON.stringify(trainingData)
        });

        const embedding = embeddingResponse.data[0].embedding;

        // Store in Pinecone
        await pineconeIndex.upsert({
          vectors: [{
            id: record.id,
            values: embedding,
            metadata: trainingData
          }],
          namespace: `${portalId}-${type}`
        });

        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          recordId: record.id,
          error: error.message
        });
        logger.error(`Error processing record ${record.id}:`, error);
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error('Error processing ideal clients:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}); 