import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../database.types.ts';
import { SemanticMatch } from './mcpTypes.ts';

export type Tables = 'profiles' | 'roles' | 'jobs' | 'companies' | 'divisions' | 'capabilities' | 'skills';
export type EntityType = 'profile' | 'role' | 'skill' | 'capability' | 'company';

export interface SemanticSimilarity {
  similarity: number;
  entityId: string;
}

export interface SemanticMetrics {
  similarityScores: {
    roleMatch?: number;
    companyFit?: number;
    divisionFit?: number;
    skillAlignment?: number;
    capabilityAlignment?: number;
  };
  matchingStrategy: 'exact' | 'semantic' | 'hybrid';
  confidenceScore: number;
}

/**
 * Creates or updates an embedding for the specified entity
 */
export async function embedContext(
  supabase: SupabaseClient<Database>,
  entityType: EntityType,
  entityId: string
): Promise<boolean> {
  try {
    // Get entity data to embed
    const { data: entity, error: entityError } = await supabase
      .from(entityType + 's') // pluralize table name
      .select('*')
      .eq('id', entityId)
      .single();

    if (entityError || !entity) {
      console.error(`Error fetching ${entityType}:`, entityError);
      return false;
    }

    // Create text to embed based on entity type
    let textToEmbed = '';
    switch (entityType) {
      case 'profile':
        textToEmbed = `${entity.name} ${entity.role_title} ${entity.division}`;
        break;
      case 'role':
        textToEmbed = `${entity.title} ${entity.primary_purpose} ${entity.grade_band}`;
        break;
      case 'skill':
        textToEmbed = `${entity.name} ${entity.category} ${entity.description}`;
        break;
      case 'capability':
        textToEmbed = `${entity.name} ${entity.group_name} ${entity.description}`;
        break;
      case 'company':
        textToEmbed = `${entity.name} ${entity.description}`;
        break;
    }

    // Get embedding from OpenAI
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: textToEmbed,
        model: 'text-embedding-ada-002'
      })
    });

    const embedData = await response.json();
    const embedding = embedData.data[0].embedding;

    // Update entity with embedding
    const { error: updateError } = await supabase
      .from(entityType + 's')
      .update({ embedding })
      .eq('id', entityId);

    if (updateError) {
      console.error(`Error updating ${entityType} embedding:`, updateError);
      return false;
    }

    return true;

  } catch (error) {
    console.error('Error in embedContext:', error);
    return false;
  }
}

/**
 * Get semantic matches from a table using vector similarity search
 */
export async function getSemanticMatches(
  supabase: SupabaseClient<Database>,
  sourceEmbedding: number[] | string,
  table: Tables,
  limit: number = 10,
  threshold: number = 0.6
): Promise<SemanticMatch[]> {
  try {
    let rpcName: string;
    let params: Record<string, any>;

    if (typeof sourceEmbedding === 'string') {
      rpcName = 'match_embeddings_by_id';
      params = {
        p_query_id: sourceEmbedding,
        p_table_name: table,
        p_match_threshold: threshold,
        p_match_count: limit
      };
    } else {
      rpcName = 'match_embeddings_by_vector';
      params = {
        p_query_embedding: sourceEmbedding,
        p_table_name: table,
        p_match_threshold: threshold,
        p_match_count: limit
      };
    }

    const { data, error } = await supabase.rpc(rpcName, params);

    if (error) {
      console.error(`Error in ${rpcName}:`, error);
      return [];
    }

    if (!data || !Array.isArray(data)) {
      console.error('Invalid response format:', data);
      return [];
    }

    return data.map((match: any) => ({
      id: match.id,
      similarity: match.similarity,
      type: table.slice(0, -1) as EntityType,
      name: match.name || match.title,
      metadata: match
    }));
  } catch (error) {
    console.error('Error in getSemanticMatches:', error);
    return [];
  }
}

/**
 * Calculate semantic alignment between two entities
 */
export async function calculateSemanticAlignment(
  supabase: SupabaseClient<Database>,
  sourceId: string,
  targetId: string,
  sourceTable: Tables,
  targetTable: Tables
): Promise<number> {
  const { data, error } = await supabase
    .rpc('calculate_embedding_similarity', {
      source_id: sourceId,
      target_id: targetId,
      source_table: sourceTable,
      target_table: targetTable
    });

  if (error) throw error;
  return data || 0;
}

/**
 * Get aggregated semantic alignment across multiple related entities
 */
export async function getAggregatedAlignment(
  supabase: SupabaseClient<Database>,
  sourceId: string,
  relatedTable: Tables,
  relationTable: string,
  sourceTable: Tables = 'profiles'
): Promise<number> {
  const { data, error } = await supabase
    .rpc('calculate_aggregated_similarity', {
      source_id: sourceId,
      related_table: relatedTable,
      relation_table: relationTable,
      source_table: sourceTable
    });

  if (error) throw error;
  return data || 0;
} 