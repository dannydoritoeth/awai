import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../shared/cors.ts';
import { embedContext } from '../shared/embeddings.ts';

interface TestEmbeddingsRequest {
  function: string;
  params: {
    entityType?: 'profile' | 'role' | 'skill' | 'capability' | 'company';
    entityId?: string;
    queryEmbedding?: number[];
    tableName?: string;
    matchThreshold?: number;
    matchCount?: number;
    sourceId?: string;
    targetId?: string;
    sourceTable?: string;
    targetTable?: string;
  };
}

// Initialize Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { function: functionName, params } = await req.json() as TestEmbeddingsRequest;

    let result;
    console.log(`Testing embedding function: ${functionName}`, params);

    switch (functionName) {
      case 'embedContext':
        if (!params.entityType || !params.entityId) {
          throw new Error('entityType and entityId are required for embedContext');
        }
        result = await embedContext(supabaseClient, params.entityType, params.entityId);
        break;

      case 'match_embeddings_by_vector':
        if (!params.queryEmbedding || !params.tableName) {
          throw new Error('queryEmbedding and tableName are required for match_embeddings_by_vector');
        }
        result = await supabaseClient.rpc('match_embeddings_by_vector', {
          p_query_embedding: params.queryEmbedding,
          p_table_name: params.tableName,
          p_match_threshold: params.matchThreshold || 0.5,
          p_match_count: params.matchCount || 10
        });
        break;

      case 'match_embeddings_by_id':
        if (!params.entityId || !params.tableName) {
          throw new Error('entityId and tableName are required for match_embeddings_by_id');
        }
        result = await supabaseClient.rpc('match_embeddings_by_id', {
          p_query_id: params.entityId,
          p_table_name: params.tableName,
          p_match_threshold: params.matchThreshold || 0.5,
          p_match_count: params.matchCount || 10
        });
        break;

      case 'calculate_embedding_similarity':
        if (!params.sourceId || !params.targetId || !params.sourceTable || !params.targetTable) {
          throw new Error('sourceId, targetId, sourceTable, and targetTable are required for calculate_embedding_similarity');
        }
        result = await supabaseClient.rpc('calculate_embedding_similarity', {
          source_id: params.sourceId,
          target_id: params.targetId,
          source_table: params.sourceTable,
          target_table: params.targetTable
        });
        break;

      case 'get_embedding':
        if (!params.entityId || !params.tableName) {
          throw new Error('entityId and tableName are required for get_embedding');
        }
        result = await supabaseClient
          .from(params.tableName)
          .select('id, embedding')
          .eq('id', params.entityId)
          .single();
        break;

      default:
        throw new Error(`Function ${functionName} not implemented`);
    }

    return new Response(
      JSON.stringify({
        function: functionName,
        params,
        result
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in test-embeddings:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
}); 