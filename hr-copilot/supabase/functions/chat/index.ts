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
import { createMCPLoopBody } from '../shared/chatUtils.ts';

// Initialize Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
);

// Helper to call MCP loop
async function callMCPLoop(
  sessionId: string, 
  message: string, 
  mode: 'candidate' | 'hiring' | 'general' | 'analyst', 
  entityId?: string,
  insightId?: string,
  scope?: string,
  companyIds?: string[],
  actionData?: {
    actionId: string;
    params: Record<string, any>;
  }
) {
  // Always use v2 endpoint
  const endpoint = '/functions/v1/mcp-loop-v2';
  console.log('Calling MCP loop with endpoint:', endpoint);
  
  // Create the MCP loop body using the shared utility
  const mcpLoopBody = createMCPLoopBody(
    mode,
    sessionId,
    message,
    entityId,
    insightId,
    scope,
    companyIds,
    actionData
  );

  console.log('MCP Loop Request Body:', JSON.stringify(mcpLoopBody, null, 2));

  const mcpResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
    },
    body: JSON.stringify(mcpLoopBody)
  });

  if (!mcpResponse.ok) {
    const error = await mcpResponse.json();
    throw new Error(`MCP Loop failed: ${error.message || 'Unknown error'}`);
  }

  return mcpResponse.json();
}

/**
 * Process the initial message when starting a session
 */
async function processInitialMessage(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  mode: MCPMode,
  entityId: string | null,
  message: string
): Promise<{ error: ChatError | null }> {
  try {
    // First log the user's message
    const { error: messageError } = await postUserMessage(
      supabase,
      sessionId,
      message
    );
    if (messageError) throw messageError;

    // Create the MCP loop body using the shared utility
    const mcpLoopBody = createMCPLoopBody(
      mode,
      sessionId,
      message,
      entityId || undefined
    );

    // Always use v2 endpoint
    const endpoint = '/functions/v1/mcp-loop-v2';
    console.log('Calling MCP loop with endpoint:', endpoint);
    
    const mcpResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
      },
      body: JSON.stringify(mcpLoopBody)
    });

    if (!mcpResponse.ok) {
      const error = await mcpResponse.json();
      throw new Error(`MCP Loop failed: ${error.message || 'Unknown error'}`);
    }

    const mcpResult = await mcpResponse.json();
    
    if (!mcpResult.success || !mcpResult.data?.chatResponse) {
      throw new Error('Failed to get response from MCP loop');
    }

    // Log the AI's response
    const { error: replyError } = await logAgentResponse(
      supabase,
      sessionId,
      mcpResult.data.chatResponse.message,
      'initial_response',
      undefined,
      {
        followUpQuestion: mcpResult.data.chatResponse.followUpQuestion
      }
    );
    if (replyError) throw replyError;

    return { error: null };
  } catch (error) {
    console.error('Error processing initial message:', error);
    return {
      error: {
        type: 'PROCESSING_ERROR',
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
  mode: 'candidate' | 'hiring' | 'general' | 'analyst',
  entityId?: string,
  browserSessionId?: string,
  initialMessage?: string,
  insightId?: string,
  scope?: string,
  companyIds?: string[]
): Promise<{ sessionId: string | null; error: ChatError | null }> {
  try {
    // Create new session
    const { data: session, error: sessionError } = await startChatSession(
      supabaseClient,
      mode,
      entityId,
      browserSessionId,
      initialMessage,
      insightId,
      scope,
      companyIds
    );

    if (sessionError || !session) {
      throw sessionError || new Error('Failed to create session');
    }

    const sessionId = session.id;

    // If there's an initial message, log it and trigger MCP asynchronously
    if (initialMessage) {
      // Create the MCP loop body
      const mcpLoopBody = createMCPLoopBody(
        mode,
        sessionId,
        initialMessage,
        entityId,
        insightId,
        scope,
        companyIds
      );

      // Log the initial message with the MCP loop body
      await postUserMessage(supabaseClient, sessionId, initialMessage, undefined, mcpLoopBody);

      // Always use v2 endpoint
      const endpoint = '/functions/v1/mcp-loop-v2';
      console.log('Calling MCP loop with endpoint:', endpoint);

      fetch(`${Deno.env.get('SUPABASE_URL')}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
        },
        body: JSON.stringify(mcpLoopBody)
      }).catch(error => {
        console.error('Async MCP call failed:', error);
        // Log the error but don't block the response
        logAgentAction(supabaseClient, {
          entityType: 'chat',
          entityId: sessionId,
          payload: {
            stage: 'mcp_error',
            error: error.message
          }
        }).catch(console.error);
      });
    }

    return {
      sessionId,
      error: null
    };
  } catch (error) {
    console.error('Error in startSession:', error);
    return {
      sessionId: null,
      error: {
        type: 'SESSION_ERROR',
        message: error.message || 'Failed to start chat session',
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
    const requestBody = await req.json();
    const { 
      action, 
      sessionId,
      message, 
      profileId, 
      roleId,
      actionId,
      roleTitle,
      companyId, 
      browserSessionId, 
      messageId: requestMessageId,
      insightId,
      scope,
      companyIds 
    } = requestBody;

    // For non-startSession actions, require sessionId in body
    if (action !== 'startSession' && !sessionId) {
      throw new Error('Session ID is required in request body for existing sessions');
    }

    console.log('Received request:', { 
      action,
      sessionId,
      message, 
      profileId, 
      roleId,
      actionId,
      roleTitle, 
      companyId, 
      browserSessionId,
      insightId,
      scope,
      companyIds 
    });

    // Validate required fields
    if (!action) {
      throw new Error('Action is required');
    }

    switch (action) {
      case 'startSession': {
        console.log('Starting new session with params:', { 
          profileId, 
          roleId, 
          companyId, 
          message, 
          browserSessionId,
          insightId,
          scope,
          companyIds 
        });
        
        // Require browserSessionId for anonymous users
        if (!browserSessionId) {
          throw new Error('Browser session ID is required');
        }

        // Allow starting a general session with no IDs
        if ((profileId && roleId) || (profileId && companyId) || (roleId && companyId)) {
          throw new Error('Cannot provide multiple IDs - choose one mode');
        }

        // Determine mode based on request
        let mode: 'candidate' | 'hiring' | 'general' | 'analyst';
        let entityId: string | undefined;

        if (profileId) {
          mode = 'candidate';
          entityId = profileId;
        } else if (roleId) {
          mode = 'hiring';
          entityId = roleId;
        } else if (companyIds?.length > 0) {
          mode = 'analyst';
          entityId = companyIds[0]; // Use first company ID as the primary entity ID
        } else {
          mode = 'general';
          entityId = undefined; // Ensure entity_id is null for general mode
        }

        console.log('Determined mode and entityId:', { mode, entityId });

        try {
          // Start the chat session
          const { sessionId: newSessionId, error: startError } = await startSession(
            supabaseClient,
            mode,
            entityId,
            browserSessionId,
            message,
            insightId,
            scope,
            companyIds
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
                followUpQuestion: lastMessage.responseData?.followUpQuestion
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
          throw new Error(`Failed to start chat session: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      case 'postMessage': {
        // Message is required
        if (!message) {
          throw new Error('Message is required');
        }

        // Extract all potential action data from the request
        const actionData = {
          actionId,
          params: {
            roleId,
            roleTitle,
            profileId,
            ...requestBody // Include any additional params from request body
          }
        };

        // Log the complete request with all available parameters
        const requestLog = {
          action,
          sessionId,
          message,
          actionData,
          ...requestBody
        };

        console.log('Chat Endpoint Received Request:', JSON.stringify(requestLog, null, 2));

        try {
          // Get session details to determine mode and entity ID
          const { data: session, error: sessionError } = await supabaseClient
            .from('conversation_sessions')
            .select('mode, entity_id')
            .eq('id', sessionId)
            .single();

          if (sessionError) {
            console.error('Session lookup error:', sessionError);
            throw new Error('Failed to lookup session');
          }

          if (!session) {
            throw new Error('Invalid session ID');
          }

          // Call MCP loop with all parameters
          const mcpResponse = await callMCPLoop(
            sessionId,
            message,
            session.mode,
            session.entity_id,
            undefined,
            undefined,
            undefined,
            actionData.actionId ? actionData : undefined // Only pass actionData if actionId exists
          );

          console.log('Chat Endpoint Received from MCP Loop V2:', JSON.stringify(mcpResponse, null, 2));

          return new Response(JSON.stringify(mcpResponse), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('Error in postMessage:', error);
          throw error;
        }
      }

      case 'getHistory':
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
    
    const chatError = {
      type: error instanceof Error ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      details: error
    };

    return new Response(
      JSON.stringify({ error: chatError }), 
      {
        status: chatError.type === 'VALIDATION_ERROR' ? 400 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}); 