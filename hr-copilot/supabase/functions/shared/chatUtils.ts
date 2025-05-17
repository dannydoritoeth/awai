import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../database.types.ts';
import { ChatMessage, ChatSender, ConversationSession, ChatError } from './chatTypes.ts';
import { logAgentAction } from './agent/logAgentAction.ts';
import { MCPMode, SemanticMatch } from './mcpTypes.ts';
import { generateEmbedding } from './semanticSearch.ts';

// Type definitions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

/**
 * Start a new chat session
 */
export async function startChatSession(
  supabaseClient: SupabaseClient,
  mode: 'candidate' | 'hiring' | 'general',
  entityId?: string,
  browserSessionId?: string
) {
  try {
    const { data, error } = await supabaseClient
      .from('conversation_sessions')
      .insert({
        mode,
        entity_id: mode === 'general' ? null : entityId,
        browser_session_id: browserSessionId,
        status: 'active'
      })
      .select('id')
      .single();

    if (error) throw error;

    return {
      data,
      error: null
    };
  } catch (error) {
    console.error('Error starting chat session:', error);
    return {
      data: null,
      error
    };
  }
}

/**
 * Post a user message to a chat session
 */
export async function postUserMessage(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  message: string,
  messageId?: string
): Promise<{ messageId: string; error?: ChatError }> {
  try {
    // Generate embedding for the message
    const embedding = await generateEmbedding(message);

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        id: messageId, // Use provided messageId if available
        session_id: sessionId,
        sender: 'user',
        message,
        embedding
      })
      .select('id')
      .single();

    if (error) throw error;
    return { messageId: data.id };
  } catch (error) {
    return {
      messageId: '',
      error: {
        type: 'DATABASE_ERROR',
        message: 'Failed to post user message',
        details: error
      }
    };
  }
}

/**
 * Log an agent response to a chat session
 */
export async function logAgentResponse(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  message: string,
  actionType?: string,
  toolCall?: Record<string, any>,
  responseData?: Record<string, any>
): Promise<{ messageId: string; error?: ChatError }> {
  try {
    console.log('logAgentResponse called with:', { sessionId, message, actionType });
    
    // Generate embedding for the message
    const embedding = await generateEmbedding(message);
    console.log('Generated embedding for message');

    // Log the message
    const { data: messageData, error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        sender: 'assistant',
        message,
        tool_call: toolCall,
        response_data: responseData,
        embedding
      })
      .select('id')
      .single();

    if (messageError) {
      console.error('Error inserting chat message:', messageError);
      throw messageError;
    }
    console.log('Successfully inserted chat message with ID:', messageData?.id);

    // If there's an action type, log it to agent_actions
    if (actionType) {
      console.log('Logging action to agent_actions:', actionType);
      const { data: session } = await supabase
        .from('conversation_sessions')
        .select('profile_id')
        .eq('id', sessionId)
        .single();

      if (session) {
        await logAgentAction(supabase, {
          entityType: 'profile',
          entityId: session.profile_id,
          payload: {
            type: actionType,
            message,
            toolCall,
            responseData
          }
        });
        console.log('Successfully logged agent action');
      }
    }

    return { messageId: messageData.id };
  } catch (error) {
    console.error('Full error in logAgentResponse:', error);
    return {
      messageId: '',
      error: {
        type: 'DATABASE_ERROR',
        message: 'Failed to log agent response',
        details: error
      }
    };
  }
}

/**
 * Get chat history for a session
 */
export async function getChatHistory(
  supabase: SupabaseClient<Database>,
  sessionId: string
): Promise<{ history: { session: ConversationSession | null; messages: ChatMessage[] }; error?: ChatError }> {
  try {
    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('conversation_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) throw sessionError;

    // Get messages
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (messagesError) throw messagesError;

    return {
      history: {
        session: {
          id: session.id,
          profileId: session.profile_id,
          mode: session.mode,
          entityId: session.entity_id,
          status: session.status,
          createdAt: session.created_at,
          updatedAt: session.updated_at,
          summary: session.summary
        },
        messages: messages.map(msg => ({
          id: msg.id,
          sessionId: msg.session_id,
          sender: msg.sender as ChatSender,
          message: msg.message,
          toolCall: msg.tool_call,
          responseData: msg.response_data,
          timestamp: msg.timestamp
        }))
      }
    };
  } catch (error) {
    return {
      history: { session: null, messages: [] },
      error: {
        type: 'DATABASE_ERROR',
        message: 'Failed to get chat history',
        details: error
      }
    };
  }
}

interface ChatInteractionContext {
  mode: MCPMode;
  profileId?: string;
  roleId?: string;
  actionsTaken: Array<{
    tool: string;
    reason: string;
    result: any;
  }>;
  candidateContext?: {
    matches: SemanticMatch[];
    recommendations: Array<{
      type: string;
      score: number;
      semanticScore?: number;
      summary: string;
      details: any;
    }>;
    nextActions?: string[];
    gaps?: {
      capabilities?: Array<{ name: string; gapType: 'missing' | 'insufficient' }>;
      skills?: Array<{ name: string; gapType: 'missing' | 'insufficient' }>;
    };
  };
}

/**
 * Handle chat interactions in the MCP context
 */
export async function handleChatInteraction(
  supabase: SupabaseClient<Database>,
  sessionId: string | undefined,
  message: string,
  context: ChatInteractionContext
): Promise<{ response: string; followUpQuestion?: string }> {
  try {
    let response: string;
    let followUpQuestion: string | undefined;

    // Log the interaction start
    await logAgentAction(supabase, {
      entityType: context.profileId ? 'profile' : 'role',
      entityId: context.profileId || context.roleId || '',
      payload: {
        stage: 'chat_interaction_start',
        message,
        context
      }
    });

    // Only log to chat if session ID exists
    if (sessionId) {
      // Log the user message first
      await postUserMessage(supabase, sessionId, message);
    }

    // Return the response and follow-up separately
    return { response: "Please use the appropriate MCP loop for responses", followUpQuestion: undefined };

  } catch (error) {
    console.error('Error in handleChatInteraction:', error);
    throw error;
  }
}

/**
 * Log a progress update to both agent actions and optionally to chat
 */
export async function logProgress(
  supabase: SupabaseClient<Database>,
  params: {
    entityType: 'profile' | 'role' | 'job';
    entityId?: string;
    stage: 'planning' | 'analysis' | 'scoring' | 'error' | 'summary';
    message: string;
    sessionId?: string;
    payload?: Record<string, any>;
  }
): Promise<void> {
  try {
    // Only log to agent_actions if we have an entityId
    if (params.entityId) {
      await logAgentAction(supabase, {
        entityType: params.entityType,
        entityId: params.entityId,
        payload: {
          stage: params.stage,
          message: params.message,
          ...params.payload
        }
      });
    }

    // If session ID provided, also log to chat
    if (params.sessionId) {
      await logAgentResponse(
        supabase,
        params.sessionId,
        params.message,
        `mcp_${params.stage}`,
        { stage: params.stage },
        params.payload
      );
    }
  } catch (error) {
    console.error('Error logging progress:', error);
    // Don't throw - logging failures shouldn't break the main flow
  }
}

/**
 * Get predefined progress messages for common stages
 */
export function getProgressMessage(
  stage: 'planning' | 'analysis' | 'scoring' | 'error' | 'summary',
  context: {
    matchCount?: number;
    errorType?: string;
    fallbackUsed?: boolean;
  } = {}
): string {
  switch (stage) {
    case 'planning':
      return "I'm analyzing your profile to find the best opportunities...";
    
    case 'analysis':
      return "Evaluating your experience and skills against current openings...";
    
    case 'scoring':
      if (context.matchCount === 0) {
        return "I've completed the analysis but didn't find any strong matches. Let me explain why and suggest some alternatives.";
      }
      return `I've found ${context.matchCount} ${context.matchCount === 1 ? 'role that matches' : 'roles that match'} your profile. Let me show you why.`;
    
    case 'error':
      if (context.fallbackUsed) {
        return "Some data is missing from your profile, so I used alternative methods to make suggestions.";
      }
      return "I encountered some issues while analyzing your profile. I'll do my best to provide recommendations with the available information.";
    
    case 'summary':
      return "Here's a summary of what I found...";
    
    default:
      return "Processing your request...";
  }
} 