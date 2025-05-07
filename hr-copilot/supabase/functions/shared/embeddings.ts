import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';;
import { Database } from '../database.types.ts';

type Tables = 'profiles' | 'roles' | 'jobs' | 'companies' | 'divisions' | 'capabilities' | 'skills';

export interface SemanticSimilarity {
  similarity: number;
  entityId: string;
}

/**
 * Get semantic matches from a table using vector similarity search
 */
export async function getSemanticMatches(
  supabase: SupabaseClient<Database>,
  sourceEmbedding: number[],
  table: Tables,
  limit: number = 10,
  threshold: number = 0.6
): Promise<SemanticSimilarity[]> {
  const { data, error } = await supabase
    .rpc('match_embeddings', {
      query_embedding: sourceEmbedding,
      match_threshold: threshold,
      match_count: limit,
      table_name: table
    });

  if (error) throw error;
  return data || [];
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