import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../database.types.ts';
import { SemanticMatch } from './mcpTypes.ts';

export type Tables = 'profiles' | 'roles' | 'jobs' | 'companies' | 'divisions' | 'capabilities' | 'skills' | 'agent_actions';
export type EntityType = 'profile' | 'role' | 'skill' | 'capability' | 'company' | 'agent_action';

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
      .select('*, embedding')
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

    // Store the text used for embedding to check for changes
    const currentTextHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(textToEmbed)
    ).then(hash => Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''));

    // Check if we already have an embedding and if the text hasn't changed
    const { data: existingHash } = await supabase
      .from(entityType + 's')
      .select('embedding_text_hash')
      .eq('id', entityId)
      .single();

    if (entity.embedding && existingHash?.embedding_text_hash === currentTextHash) {
      console.log(`Embedding exists and text unchanged for ${entityType} ${entityId}`);
      return true;
    }

    // Get embedding from OpenAI only if needed
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

    // Update entity with embedding and hash
    const { error: updateError } = await supabase
      .from(entityType + 's')
      .update({ 
        embedding,
        embedding_text_hash: currentTextHash
      })
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
  sourceEmbedding: number[] | { id: string, table: Tables },
  targetTable: Tables,
  limit: number = 10,
  threshold: number = 0.6
): Promise<SemanticMatch[]> {
  try {
    let rpcName: string;
    let params: Record<string, any>;

    if (typeof sourceEmbedding === 'object' && 'id' in sourceEmbedding) {
      // First get the embedding from the source table
      const { data: source, error: sourceError } = await supabase
        .from(sourceEmbedding.table)
        .select('embedding')
        .eq('id', sourceEmbedding.id)
        .single();

      if (sourceError || !source?.embedding) {
        console.error(`Error getting source embedding from ${sourceEmbedding.table}:`, sourceError);
        return [];
      }

      // Use the source embedding to find matches in the target table
      rpcName = 'match_embeddings_by_vector';
      params = {
        p_query_embedding: source.embedding,
        p_table_name: targetTable,
        p_match_threshold: threshold,
        p_match_count: limit
      };
    } else if (Array.isArray(sourceEmbedding)) {
      // If sourceEmbedding is an array, it's already a vector
      rpcName = 'match_embeddings_by_vector';
      params = {
        p_query_embedding: sourceEmbedding,
        p_table_name: targetTable,
        p_match_threshold: threshold,
        p_match_count: limit
      };
    } else {
      console.error('Invalid sourceEmbedding format');
      return [];
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

    // Get additional details for each match from their respective tables
    const matchPromises = data.map(async (match) => {
      const { data: details } = await supabase
        .from(targetTable)
        .select('*')
        .eq('id', match.id)
        .single();

      // Ensure type matches SemanticMatch interface
      const entityType = targetTable.slice(0, -1);
      console.log('Debug - Semantic Match Processing:', {
        targetTable,
        entityType,
        matchId: match.id,
        details: details ? 'found' : 'not found'
      });
      
      if (entityType !== 'role' && entityType !== 'skill' && entityType !== 'capability' && entityType !== 'company' && entityType !== 'profile') {
        console.warn(`Unexpected entity type: ${entityType}`, {
          allowedTypes: ['role', 'skill', 'capability', 'company', 'profile'],
          receivedType: entityType,
          targetTable,
          matchData: match
        });
        return null;
      }

      const semanticMatch: SemanticMatch = {
        id: match.id,
        similarity: match.similarity,
        type: entityType,
        name: details?.display_name || details?.name || details?.title || 'Unnamed'
      };

      if (details) {
        semanticMatch.metadata = details;
      }

      return semanticMatch;
    });

    const results = await Promise.all(matchPromises);
    return results.filter((match): match is SemanticMatch => match !== null);
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