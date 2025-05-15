import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { SemanticMetrics } from '../embeddings.ts';
import { generateEmbedding } from '../semanticSearch.ts';

export type EntityType = 'profile' | 'role' | 'job' | 'company' | 'division' | 'chat';

export interface AgentAction {
  entityType: EntityType;
  entityId: string;
  payload: Record<string, any>;
  semanticMetrics?: SemanticMetrics;
}

/**
 * Log an agent action with optional semantic metrics
 */
export async function logAgentAction(
  supabase: SupabaseClient<Database>,
  action: AgentAction
): Promise<void> {
  try {
    // Generate a summary of the action for embedding
    const actionSummary = `${action.entityType} ${action.payload.type || action.payload.stage || 'action'}: ${JSON.stringify(action.payload)}`;
    const embedding = await generateEmbedding(actionSummary);

    const { error } = await supabase
      .from('agent_actions')
      .insert({
        target_type: action.entityType,
        target_id: action.entityId,
        payload: action.payload,
        confidence_score: action.semanticMetrics?.confidenceScore || null,
        outcome: JSON.stringify(action.semanticMetrics || {}),
        embedding
      });

    if (error) {
      console.error('Failed to log agent action:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to log agent action:', error);
    throw error;
  }
}

/**
 * Helper to create semantic metrics object with validation
 */
export function createSemanticMetrics(
  similarityScores: SemanticMetrics['similarityScores'],
  matchingStrategy: SemanticMetrics['matchingStrategy'],
  confidenceScore: number
): SemanticMetrics {
  // Validate confidence score range
  if (confidenceScore < 0 || confidenceScore > 1) {
    throw new Error('Confidence score must be between 0 and 1');
  }

  // Validate similarity scores are between 0 and 1
  Object.entries(similarityScores).forEach(([key, value]) => {
    if (value !== undefined && (value < 0 || value > 1)) {
      throw new Error(`Similarity score for ${key} must be between 0 and 1`);
    }
  });

  return {
    similarityScores,
    matchingStrategy,
    confidenceScore
  };
} 