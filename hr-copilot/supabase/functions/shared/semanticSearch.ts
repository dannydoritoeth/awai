import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../database.types.ts';
import { SemanticMatch } from './mcpTypes.ts';
import { EntityType } from './embeddings.ts';

export interface SemanticSearchParams {
  embedding: number[];
  entityTypes: EntityType[];
  companyId?: string;
  filters?: Record<string, string>;
  limit?: number;
  perTypeLimit?: number;
  minScore?: number;
}

/**
 * Perform semantic similarity search across multiple entity types
 */
export async function getSemanticMatches(
  supabase: SupabaseClient<Database>,
  params: SemanticSearchParams
): Promise<SemanticMatch[]> {
  const {
    embedding,
    entityTypes,
    companyId,
    filters = {},
    limit = 10,
    perTypeLimit = 5,
    minScore = 0.7
  } = params;

  const results: SemanticMatch[] = [];

  // Helper to build common query parts
  const buildQuery = async (table: string, nameField: string = 'title') => {
    // First get matches from vector similarity search
    const { data: matches, error: rpcError } = await supabase
      .rpc('match_embeddings_by_vector', {
        p_query_embedding: embedding,
        p_table_name: table,
        p_match_threshold: minScore,
        p_match_count: perTypeLimit
      });

    if (rpcError) {
      console.error(`RPC error for ${table}:`, rpcError);
      return [];
    }

    if (!matches || !matches.length) {
      return [];
    }

    // Then get full details for the matched IDs
    let query = supabase
      .from(table)
      .select(`
        id,
        ${nameField},
        metadata:raw_json,
        division:divisions (
          name,
          cluster,
          agency
        )
      `)
      .in('id', matches.map(m => m.id));

    // Apply company filter if provided
    if (companyId) {
      if (table === 'companies') {
        query = query.eq('id', companyId);
      } else if (table === 'divisions') {
        query = query.eq('company_id', companyId);
      } else if (table === 'roles' || table === 'jobs') {
        query = query.eq('division.company_id', companyId);
      }
    }

    // Apply additional filters
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value) {
        query = query.eq(key, value);
      }
    });

    const { data: details, error: queryError } = await query;

    if (queryError) {
      console.error(`Query error for ${table}:`, queryError);
      return [];
    }

    // Combine similarity scores with details
    return details?.map(item => {
      const match = matches.find(m => m.id === item.id);
      return {
        id: item.id,
        type: table.slice(0, -1) as EntityType,
        name: item[nameField] || 'Unnamed',
        similarity: match?.similarity || 0,
        metadata: {
          ...item.metadata,
          ...(item.division && {
            division: item.division.name,
            cluster: item.division.cluster,
            agency: item.division.agency
          })
        }
      };
    }) || [];
  };

  // Process each entity type in parallel
  const matchPromises = entityTypes.map(async (entityType) => {
    try {
      const matches = await buildQuery(
        `${entityType}s`, // Convert type to table name
        entityType === 'role' || entityType === 'job' ? 'title' : 'name'
      );
      
      console.log(`${entityType} matches:`, {
        count: matches.length,
        matches: matches.map(m => ({
          id: m.id,
          name: m.name,
          similarity: m.similarity
        }))
      });

      results.push(...matches);
    } catch (error) {
      console.error(`Error processing ${entityType}:`, error);
    }
  });

  await Promise.all(matchPromises);

  // Sort by similarity and apply global limit
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Helper to generate embeddings for text using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OpenAI API key not found');
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text
      })
    });

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
} 