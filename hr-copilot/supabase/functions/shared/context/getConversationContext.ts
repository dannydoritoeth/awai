import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { ChatMessage, ChatSender } from '../chatTypes.ts';
import { AgentAction } from '../agent/logAgentAction.ts';

export interface ConversationContext {
  history: ChatMessage[];
  agentActions?: AgentAction[];
  summary?: string;
  contextEmbedding?: number[];
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
 * Get conversation context including recent messages, actions, and computed embedding
 */
export async function getConversationContext(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  options: {
    messageLimit?: number;
    actionLimit?: number;
    embeddingAverageCount?: number;
  } = {}
): Promise<ConversationContext> {
  const {
    messageLimit = 10,
    actionLimit = 5,
    embeddingAverageCount = 3
  } = options;

  try {
    // Get session details first
    const { data: session, error: sessionError } = await supabase
      .from('conversation_sessions')
      .select('summary')
      .eq('id', sessionId)
      .single();

    if (sessionError) throw sessionError;

    // Get recent messages (excluding system/debug)
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .not('sender', 'eq', 'system')
      .order('timestamp', { ascending: false })
      .limit(messageLimit);

    if (messagesError) throw messagesError;

    // Get recent agent actions
    const { data: actions, error: actionsError } = await supabase
      .from('agent_actions')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(actionLimit);

    if (actionsError) throw actionsError;

    // Collect recent embeddings from both messages and actions
    const recentEmbeddings: number[][] = [];
    
    // Add message embeddings
    for (const msg of messages.slice(0, embeddingAverageCount)) {
      if (msg.embedding) {
        recentEmbeddings.push(msg.embedding);
      }
    }
    
    // Add action embeddings
    for (const action of actions.slice(0, embeddingAverageCount)) {
      if (action.embedding) {
        recentEmbeddings.push(action.embedding);
      }
    }

    // Compute average embedding if we have any
    const contextEmbedding = recentEmbeddings.length > 0 
      ? computeAverageEmbedding(recentEmbeddings)
      : undefined;

    // Transform messages to ChatMessage interface
    const chatMessages = messages.map(msg => ({
      id: msg.id,
      sessionId: msg.session_id,
      sender: msg.sender as ChatSender,
      message: msg.message,
      toolCall: msg.tool_call,
      responseData: msg.response_data,
      timestamp: msg.timestamp
    }));

    // Transform actions to AgentAction interface
    const agentActions = actions.map(action => ({
      entityType: action.target_type,
      entityId: action.target_id,
      payload: action.payload,
      semanticMetrics: action.outcome ? JSON.parse(action.outcome) : undefined
    }));

    return {
      history: chatMessages,
      agentActions: agentActions.length > 0 ? agentActions : undefined,
      summary: session.summary,
      contextEmbedding
    };

  } catch (error) {
    console.error('Error getting conversation context:', error);
    // Return minimal context on error
    return {
      history: [],
      summary: undefined
    };
  }
} 