import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
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
      // Only include profileId/roleId if not in general mode
      ...(mode === 'candidate' && entityId ? { profileId: entityId } : {}),
      ...(mode === 'hiring' && entityId ? { roleId: entityId } : {}),
      context: {
        lastMessage: message,
        mode // Include mode in context to ensure proper handling
      }
    })
  });

  if (!mcpResponse.ok) {
    const error = await mcpResponse.json();
    throw new Error(`MCP Loop failed: ${error.message || 'Unknown error'}`);
  }

  return mcpResponse.json();
}

/**
 * Process the initial message for a new chat session
 */
async function processInitialMessage(
  supabase: SupabaseClient,
  sessionId: string,
  mode: 'candidate' | 'hiring' | 'general',
  entityId: string | null | undefined,
  message: string
): Promise<{ error: ChatError | null }> {
  try {
    // Post the initial message
    const { error: messageError } = await postUserMessage(supabase, sessionId, message);
    if (messageError) throw messageError;

    // Call MCP loop to process the message
    const mcpResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/mcp-loop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
      },
      body: JSON.stringify({
        mode,
        sessionId,
        profileId: mode === 'candidate' ? entityId : undefined,
        roleId: mode === 'hiring' ? entityId : undefined,
        context: {
          lastMessage: message
        }
      })
    });

    if (!mcpResponse.ok) {
      throw new Error(`Failed to process initial message: ${await mcpResponse.text()}`);
    }

    return { error: null };
  } catch (error) {
    console.error('Error processing initial message:', error);
    return {
      error: {
        type: 'DATABASE_ERROR',
        message: 'Failed to process initial message',
        details: error
      }
    };
  }
}

/**
 * Start a new chat session
 */
async function startSession(
  supabaseClient: SupabaseClient,
  mode: 'candidate' | 'hiring' | 'general',
  entityId?: string,
  initialMessage?: string
): Promise<{ sessionId: string | null; error: ChatError | null }> {
  try {
    // For general mode, entity_id should be NULL
    const finalEntityId = mode === 'general' ? null : entityId;

    // Create the session
    const { data: session, error: sessionError } = await supabaseClient
      .from('conversation_sessions')
      .insert({
        mode,
        entity_id: finalEntityId,
        status: 'active'
      })
      .select('id')
      .single();

    if (sessionError) throw sessionError;

    // If there's an initial message, process it
    if (initialMessage && session) {
      const { error: messageError } = await processInitialMessage(
        supabaseClient,
        session.id,
        mode,
        finalEntityId,
        initialMessage
      );

      if (messageError) throw messageError;
    }

    return {
      sessionId: session?.id || null,
      error: null
    };
  } catch (error) {
    console.error('Error in startSession:', error);
    return {
      sessionId: null,
      error: {
        type: 'DATABASE_ERROR',
        message: 'Failed to start chat session',
        details: error
      }
    };
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, sessionId, message, profileId, roleId } = await req.json();
    console.log('Received request:', { action, sessionId, message, profileId, roleId });

    // Validate required fields
    if (!action) {
      throw new Error('Action is required');
    }

    switch (action) {
      case 'startSession': {
        console.log('Starting new session with params:', { profileId, roleId, message });
        
        // Allow starting a general session with no IDs
        if (profileId && roleId) {
          throw new Error('Cannot provide both Profile ID and Role ID - choose one mode');
        }

        let mode: 'candidate' | 'hiring' | 'general';
        let entityId: string | undefined;

        if (profileId) {
          mode = 'candidate';
          entityId = profileId;
        } else if (roleId) {
          mode = 'hiring';
          entityId = roleId;
        } else {
          mode = 'general';
        }

        console.log('Determined mode and entityId:', { mode, entityId });

        try {
          // Start the chat session
          const { sessionId: newSessionId, error: startError } = await startSession(
            supabaseClient,
            mode,
            entityId,
            message // Pass the initial message to our new function
          );
          
          console.log('Chat session created:', { newSessionId, startError });
          
          if (startError) {
            console.error('Failed to start chat session:', startError);
            throw startError;
          }

          if (!newSessionId) {
            throw new Error('Failed to create session - no session ID returned');
          }

          let initialResponse;
          // If there's an initial message, it's already been processed by startSession
          if (message) {
            // Get the latest message to return as initial response
            const { history } = await getChatHistory(supabaseClient, newSessionId);
            const lastMessage = history?.messages?.[history.messages.length - 1];
            
            if (lastMessage && lastMessage.sender === 'assistant') {
              initialResponse = {
                messageId: lastMessage.id,
                reply: lastMessage.message,
                followUpQuestion: null // You might want to store this in the message metadata if needed
              };
            }
          }
          
          const response = {
            sessionId: newSessionId,
            mode,
            entityId,
            ...(initialResponse && { initialResponse })
          };

          console.log('Sending successful response:', response);

          return new Response(
            JSON.stringify(response), 
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        } catch (error) {
          console.error('Error in startSession:', error);
          throw new Error(`Failed to start chat session: ${error.message}`);
        }
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
          .from('conversation_sessions')
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
      message: error.message || 'An unexpected error occurred',
      details: error
    };

    return new Response(JSON.stringify({ error: chatError }), {
      status: error.type === 'VALIDATION_ERROR' ? 400 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}); 