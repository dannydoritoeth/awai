import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';
import {
  startChatSession,
  postUserMessage,
  logAgentResponse,
  getChatHistory
} from '../_shared/chatUtils.ts';
import { ChatError } from '../_shared/chatTypes.ts';

// Initialize Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, sessionId, message, profileId } = await req.json();

    // Validate required fields
    if (!action) {
      throw new Error('Action is required');
    }

    switch (action) {
      case 'startSession':
        if (!profileId) {
          throw new Error('Profile ID is required to start a session');
        }
        const { sessionId: newSessionId, error: startError } = await startChatSession(
          supabaseClient,
          profileId
        );
        if (startError) throw startError;
        return new Response(JSON.stringify({ sessionId: newSessionId }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'postMessage':
        if (!sessionId || !message) {
          throw new Error('Session ID and message are required');
        }
        const { messageId, error: postError } = await postUserMessage(
          supabaseClient,
          sessionId,
          message
        );
        if (postError) throw postError;
        return new Response(JSON.stringify({ messageId }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

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
    const chatError: ChatError = {
      type: 'VALIDATION_ERROR',
      message: error.message,
      details: error
    };

    return new Response(JSON.stringify({ error: chatError }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}); 