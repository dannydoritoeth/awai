import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../shared/cors.ts';
import {
  startChatSession,
  postUserMessage,
  logAgentResponse,
  getChatHistory
} from '../shared/chatUtils.ts';
import { ChatError } from '../shared/chatTypes.ts';

// Initialize Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
);

// Helper to call MCP loop
async function callMCPLoop(sessionId: string, message: string, mode: 'candidate' | 'hiring' | 'general', entityId?: string) {
  const mcpResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/mcp-loop`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
    },
    body: JSON.stringify({
      mode,
      sessionId,
      ...(mode === 'candidate' ? { profileId: entityId } : {}),
      ...(mode === 'hiring' ? { roleId: entityId } : {}),
      context: {
        lastMessage: message
      }
    })
  });

  if (!mcpResponse.ok) {
    const error = await mcpResponse.json();
    throw new Error(`MCP Loop failed: ${error.message || 'Unknown error'}`);
  }

  return mcpResponse.json();
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, sessionId, message, profileId, roleId } = await req.json();

    // Validate required fields
    if (!action) {
      throw new Error('Action is required');
    }

    switch (action) {
      case 'startSession': {
        // Allow starting a general session with no IDs
        if (profileId && roleId) {
          throw new Error('Cannot provide both Profile ID and Role ID - choose one mode');
        }

        let mode: 'candidate' | 'hiring' | 'general';
        let entityId: string | null = null;

        if (profileId) {
          mode = 'candidate';
          entityId = profileId;
        } else if (roleId) {
          mode = 'hiring';
          entityId = roleId;
        } else {
          mode = 'general';
        }

        const { sessionId: newSessionId, error: startError } = await startChatSession(
          supabaseClient,
          entityId,
          mode
        );
        if (startError) throw startError;
        
        return new Response(
          JSON.stringify({ 
            sessionId: newSessionId,
            mode,
            entityId 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      case 'postMessage': {
        // Session ID and message are required
        if (!sessionId) {
          throw new Error('Session ID is required');
        }
        if (!message) {
          throw new Error('Message is required');
        }

        // Get session details to determine mode and entity ID
        const { data: session, error: sessionError } = await supabaseClient
          .from('chat_sessions')
          .select('mode, entity_id')
          .eq('id', sessionId)
          .single();

        if (sessionError || !session) {
          throw new Error('Invalid session ID or session not found');
        }

        // Save user message
        const { messageId, error: postError } = await postUserMessage(
          supabaseClient,
          sessionId,
          message
        );
        if (postError) throw postError;

        // Call MCP loop with session context
        const mcpResult = await callMCPLoop(
          sessionId,
          message,
          session.mode,
          session.entity_id || undefined
        );
        
        if (!mcpResult.success || !mcpResult.data?.chatResponse) {
          throw new Error('Failed to get response from MCP loop');
        }

        // Log assistant's reply
        const { error: replyError } = await logAgentResponse(
          supabaseClient,
          sessionId,
          mcpResult.data.chatResponse.message
        );
        if (replyError) throw replyError;

        // Return the response
        return new Response(
          JSON.stringify({
            messageId,
            reply: mcpResult.data.chatResponse.message,
            followUpQuestion: mcpResult.data.chatResponse.followUpQuestion
          }), 
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      case 'getHistory':
        if (!sessionId) {
          throw new Error('Session ID is required');
        }
        const { history, error: historyError } = await getChatHistory(
          supabaseClient,
          sessionId
        );
        if (historyError) throw historyError;
        return new Response(JSON.stringify(history), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Chat API Error:', error);
    
    const chatError: ChatError = {
      type: error.type || 'INTERNAL_ERROR',
      message: error.message,
      details: error
    };

    return new Response(JSON.stringify({ error: chatError }), {
      status: error.type === 'VALIDATION_ERROR' ? 400 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}); 