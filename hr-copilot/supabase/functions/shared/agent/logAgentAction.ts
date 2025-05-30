import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { SemanticMetrics } from '../embeddings.ts';
import { generateEmbedding } from '../semanticSearch.ts';

export interface AgentAction {
  id: string;
  agent_name: string;
  action_type: string;
  target_type?: string;
  target_id?: string;
  request: Record<string, any>;
  request_hash?: string;
  response?: {
    summary?: string;
    dataForPrompt?: Record<string, any>;
    [key: string]: any;
  };
  outcome: 'success' | 'error';
  confidence_score?: number;
  session_id: string;
  step_index: number;
  embedding?: number[];
  timestamp: string;
}

// Actions that don't need embeddings (simple status updates or processing steps)
const SKIP_EMBEDDING_ACTIONS = [
  'Applied response formatting',
  'Retrieved planner recommendations',
  'Retrieved conversation context',
  'Executed candidate mode processing',
  'MCP Processing Step V2',
  'Tool Execution',
  'Processing Step'
];

/**
 * Log an agent action with optional semantic metrics
 */
export async function logAgentAction(
  supabase: SupabaseClient<Database>,
  action: AgentAction
): Promise<void> {
  try {
    // Check if this is a simple status update or processing step
    const actionType = action.payload.type || action.payload.action || action.payload.stage;
    const shouldSkipEmbedding = SKIP_EMBEDDING_ACTIONS.some(skipAction => 
      actionType?.includes(skipAction) || 
      action.payload.reason?.includes(skipAction)
    );

    let embedding = null;
    if (!shouldSkipEmbedding) {
      // Generate a summary of the action for embedding
      const actionSummary = `${action.entityType} ${actionType}: ${JSON.stringify(action.payload)}`;
      embedding = await generateEmbedding(actionSummary);
    }

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