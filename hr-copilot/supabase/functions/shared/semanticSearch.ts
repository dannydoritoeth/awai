import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../database.types.ts';

export type EntityType = 'role' | 'job' | 'profile' | 'division' | 'company';

export interface SemanticMatch {
  id: string;
  entityType: EntityType;
  name: string;
  similarity: number;
  summary?: string;
  metadata?: Record<string, any>;
}

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
  const buildQuery = (table: string, nameField: string = 'title') => {
    let query = supabase
      .rpc('match_embeddings_by_vector', {
        p_query_embedding: embedding,
        p_table_name: table,
        p_match_threshold: minScore,
        p_match_count: perTypeLimit
      })
      .select(`
        id,
        ${nameField},
        similarity,
        metadata:raw_json
      `)
      .from(table)
      .order('similarity', { ascending: false });

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
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        query = query.eq(key, value);
      }
    });

    return query;
  };

  // Process each entity type in parallel
  await Promise.all(entityTypes.map(async (entityType) => {
    try {
      let query;
      switch (entityType) {
        case 'role':
          query = buildQuery('roles')
            .select(`
              division:divisions (
                name,
                cluster,
                agency
              )
            `);
          break;

        case 'job':
          query = buildQuery('jobs')
            .select(`
              role:roles (
                title,
                division:divisions (
                  name,
                  cluster,
                  agency
                )
              )
            `);
          break;

        case 'profile':
          query = buildQuery('profiles', 'name')
            .select(`
              role_title,
              division
            `);
          break;

        case 'division':
          query = buildQuery('divisions', 'name')
            .select(`
              cluster,
              agency,
              company:companies (
                name
              )
            `);
          break;

        case 'company':
          query = buildQuery('companies', 'name');
          break;

        default:
          console.warn(`Unsupported entity type: ${entityType}`);
          return;
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Error fetching ${entityType} matches:`, error);
        return;
      }

      if (data) {
        results.push(...data.map(item => ({
          id: item.id,
          entityType,
          name: item[item.title ? 'title' : 'name'],
          similarity: item.similarity,
          metadata: {
            ...item.metadata,
            ...(item.division && {
              division: item.division.name,
              cluster: item.division.cluster,
              agency: item.division.agency
            }),
            ...(item.role && {
              roleTitle: item.role.title,
              division: item.role.division.name,
              cluster: item.role.division.cluster,
              agency: item.role.division.agency
            }),
            ...(item.company && {
              companyName: item.company.name
            }),
            role_title: item.role_title,
            division: item.division
          }
        })));
      }
    } catch (error) {
      console.error(`Error processing ${entityType}:`, error);
    }
  }));

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
        model: 'text-embedding-3-small',
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