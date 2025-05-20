import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js';
import type { Database } from '../../database.types.ts';
import { ChatMessageV2 } from '../mcp/types/action.ts';
import { AgentAction } from '../agent/logAgentAction.ts';

export interface ConversationContextV2 {
  history: ChatMessageV2[];
  agentActions: AgentAction[];
  summary: string;
  contextEmbedding: number[];
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
 * Get conversation context including history, actions, and embeddings
 */
export async function getConversationContextV2(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  options: {
    messageLimit?: number;
    actionLimit?: number;
    embeddingAverageCount?: number;
  } = {}
): Promise<ConversationContextV2> {
  const {
    messageLimit = 10,
    actionLimit = 5,
    embeddingAverageCount = 3
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
  const { data: actions, error: actionsError } = await supabase
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
    .from('conversation_summaries')
    .select('summary')
    .eq('session_id', sessionId)
    .single();

  if (summaryError && summaryError.code !== 'PGRST116') {
    console.error('Error fetching summary:', summaryError);
    throw summaryError;
  }

  // Get embeddings for recent messages
  const embeddings = messages
    ?.slice(0, embeddingAverageCount)
    .map(m => m.embedding)
    .filter(Boolean) || [];

  return {
    history: messages?.map(m => ({
      id: m.id,
      content: m.message,
      role: m.sender === 'assistant' ? 'assistant' : 'user',
      timestamp: m.timestamp
    })) || [],
    agentActions: actions || [],
    summary: summary?.summary || '',
    contextEmbedding: computeAverageEmbedding(embeddings)
  };
} 