import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../database.types.ts';
import { ChatMessage, ChatSender, ConversationSession, ChatError } from './chatTypes.ts';
import { logAgentAction } from './agent/logAgentAction.ts';
import { MCPMode } from './mcpTypes.ts';

/**
 * Start a new chat session for a profile
 */
export async function startChatSession(
  supabase: SupabaseClient<Database>,
  profileId: string
): Promise<{ sessionId: string; error?: ChatError }> {
  try {
    const { data, error } = await supabase
      .from('conversation_sessions')
      .insert({ profile_id: profileId })
      .select('id')
      .single();

    if (error) throw error;
    return { sessionId: data.id };
  } catch (error) {
    return {
      sessionId: '',
      error: {
        type: 'DATABASE_ERROR',
        message: 'Failed to create chat session',
        details: error
      }
    };
  }
}

/**
 * Post a user message to a chat session
 */
export async function postUserMessage(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  message: string
): Promise<{ messageId: string; error?: ChatError }> {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        sender: 'user',
        message
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
    // Log the message
    const { data: messageData, error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        sender: 'assistant',
        message,
        tool_call: toolCall,
        response_data: responseData
      })
      .select('id')
      .single();

    if (messageError) throw messageError;

    // If there's an action type, log it to agent_actions
    if (actionType) {
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
      }
    }

    return { messageId: messageData.id };
  } catch (error) {
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
}

/**
 * Handle chat interactions in the MCP context
 */
export async function handleChatInteraction(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  message: string,
  context: ChatInteractionContext
): Promise<void> {
  try {
    // Log the user message
    await postUserMessage(supabase, sessionId, message);

    // Create summary of actions taken
    const actionSummary = context.actionsTaken
      .map(action => `${action.tool}: ${action.reason}`)
      .join('\n');

    // Create a response message based on actions
    const responseMessage = context.actionsTaken.length > 0
      ? `Based on your message, I took the following actions:\n${actionSummary}`
      : 'I processed your message but no specific actions were needed.';

    // Log the agent's response with actions taken
    await logAgentResponse(
      supabase,
      sessionId,
      responseMessage,
      'mcp_chat_interaction',
      {
        mode: context.mode,
        profileId: context.profileId,
        roleId: context.roleId
      },
      { actionsTaken: context.actionsTaken }
    );

  } catch (error) {
    console.error('Error in handleChatInteraction:', error);
    throw error;
  }
} 