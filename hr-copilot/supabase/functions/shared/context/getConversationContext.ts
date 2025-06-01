import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js';
import type { Database } from '../../database.types.ts';
import { ChatMessageV2 } from '../mcp/types/action.ts';
import { AgentAction } from '../agent/logAgentAction.ts';
import { getSemanticMatches } from '../semanticSearch.ts';
import { SemanticMatch } from '../mcpTypes.ts';
import { EntityType } from '../embeddings.ts';

export interface ConversationContextV2 {
  contextEmbedding: number[];
  summary: string;
  agentActions: AgentAction[];
  pastMessages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

/**
 * Helper to compute average embedding from multiple embeddings
 */
function computeAverageEmbedding(embeddings: number[][]): number[] {
  if (!embeddings.length) return [];
  
  const vectorLength = embeddings[0].length;
  const sumVector = new Array(vectorLength).fill(0);
  
  for (const embedding of embeddings) {
    for (let i = 0; i < vectorLength; i++) {
      sumVector[i] += embedding[i];
    }
  }
  
  return sumVector.map(sum => sum / embeddings.length);
}

/**
 * Strips large payloads from agent actions to minimize token usage
 */
function stripLargePayloads(action: AgentAction): AgentAction {
  const { response, ...rest } = action;
  
  // Extract only summary and dataForPrompt if present
  const strippedResponse = {
    ...response,
    summary: response?.summary || null,
    dataForPrompt: response?.dataForPrompt || null
  };

  // Remove potentially large fields
  delete strippedResponse.rawAiResponse;
  delete strippedResponse.prompt;
  delete strippedResponse.fullContext;

  return {
    ...rest,
    response: strippedResponse
  };
}

/**
 * Get conversation context including history, actions, and embeddings
 */
export async function getConversationContextV2(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  options: {
    messageLimit?: number;
    actionLimit?: number;
    semanticActionMatchThreshold?: number;
    semanticActionLimit?: number;
    queryEmbedding?: number[];
  } = {}
): Promise<ConversationContextV2> {
  const {
    messageLimit = 5,
    actionLimit = 5,
    semanticActionMatchThreshold = 0.75,
    semanticActionLimit = 3,
    queryEmbedding
  } = options;

  // Get recent messages
  const { data: messages, error: messagesError } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: false })
    .limit(messageLimit);

  if (messagesError) {
    console.error('Error fetching messages:', messagesError);
    throw messagesError;
  }

  // Get recent agent actions
  const { data: recentActions, error: actionsError } = await supabase
    .from('agent_actions')
    .select('*')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: false })
    .limit(actionLimit);

  if (actionsError) {
    console.error('Error fetching actions:', actionsError);
    throw actionsError;
  }

  // Get conversation summary
  const { data: summary, error: summaryError } = await supabase
    .from('conversation_sessions')
    .select('summary')
    .eq('id', sessionId)
    .single();

  if (summaryError && summaryError.code !== 'PGRST116') {
    console.error('Error fetching summary:', summaryError);
    throw summaryError;
  }

  // Get embeddings for recent messages
  const contextEmbedding = messages?.[0]?.embedding || [];

  // If queryEmbedding provided, fetch semantically similar actions using database vector similarity
  let semanticActions: AgentAction[] = [];
  if (queryEmbedding && queryEmbedding.length > 0) {
    try {
      const similarActions = await getSemanticMatches(supabase, {
        embedding: queryEmbedding,
        entityTypes: ['agent_actions' as EntityType],
        limit: semanticActionLimit,
        minScore: semanticActionMatchThreshold,
        filters: {
          session_id: sessionId
        }
      });

      semanticActions = similarActions
        .filter((match): match is SemanticMatch & { metadata: AgentAction } => 
          match.metadata !== null && typeof match.metadata === 'object'
        )
        .map(match => match.metadata);
    } catch (error) {
      console.error('Error fetching semantic actions:', error);
      // Continue without semantic actions
    }
  }

  // Combine and deduplicate actions
  const seenActionIds = new Set<string>();
  const combinedActions = [...(recentActions || []), ...semanticActions]
    .filter(action => {
      if (seenActionIds.has(action.id)) return false;
      seenActionIds.add(action.id);
      return true;
    })
    .map(action => {
      // Extract only necessary fields to minimize payload
      const { response, ...rest } = action;
      const safeResponse = response as Record<string, any> | undefined;
      
      return {
        ...rest,
        response: safeResponse ? {
          summary: typeof safeResponse.summary === 'string' ? safeResponse.summary : undefined,
          dataForPrompt: safeResponse.dataForPrompt || undefined
        } : undefined
      };
    });

  // Convert messages to pastMessages format
  const pastMessages = messages?.map(m => ({
    role: m.sender === 'assistant' ? 'assistant' : 'user',
    content: m.message
  })) || [];

  return {
    contextEmbedding,
    summary: summary?.summary || '',
    agentActions: combinedActions,
    pastMessages
  };
} 