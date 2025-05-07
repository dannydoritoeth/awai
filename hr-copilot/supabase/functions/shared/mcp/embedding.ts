import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { SemanticMatch } from '../mcpTypes.ts';

type EntityType = 'profile' | 'role' | 'skill' | 'capability' | 'company';

/**
 * Creates or updates an embedding for the specified entity
 */
export async function embedContext(
  supabase: SupabaseClient,
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
 * Gets semantic matches for an entity from a target table
 */
export async function getSemanticMatches(
  supabase: SupabaseClient,
  sourceId: string,
  sourceType: EntityType,
  targetType: EntityType,
  minSimilarity: number = 0.7,
  limit: number = 10
): Promise<SemanticMatch[]> {
  try {
    const { data, error } = await supabase
      .rpc('match_embeddings', {
        query_id: sourceId,
        source_table: sourceType + 's',
        target_table: targetType + 's',
        match_threshold: minSimilarity,
        match_count: limit
      });

    if (error) {
      console.error('Error getting semantic matches:', error);
      return [];
    }

    return data.map((match: any) => ({
      id: match.id,
      similarity: match.similarity,
      type: targetType,
      name: match.name || match.title,
      metadata: match
    }));

  } catch (error) {
    console.error('Error in getSemanticMatches:', error);
    return [];
  }
} 