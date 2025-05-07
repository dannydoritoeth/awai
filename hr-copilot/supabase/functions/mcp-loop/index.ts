import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';
import { MCPRequest, MCPResponse, MCPMode } from '../_shared/mcpTypes.ts';
import { runCandidateLoop } from '../_shared/mcp/candidate.ts';
import { runHiringLoop } from '../_shared/mcp/hiring.ts';
import { handleChatInteraction } from '../_shared/mcp/chat.ts';

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
    const request: MCPRequest = await req.json();

    // Validate required fields
    if (!request.mode) {
      throw new Error('Mode is required');
    }

    if (request.mode === 'candidate' && !request.profileId) {
      throw new Error('Profile ID is required for candidate mode');
    }

    if (request.mode === 'hiring' && !request.roleId) {
      throw new Error('Role ID is required for hiring mode');
    }

    let response: MCPResponse;

    // Run the appropriate loop based on mode
    if (request.mode === 'candidate') {
      response = await runCandidateLoop(supabaseClient, request);
    } else {
      response = await runHiringLoop(supabaseClient, request);
    }

    // If there's a chat session, handle the interaction
    if (request.sessionId && request.context?.lastMessage) {
      const chatResponse = await handleChatInteraction(
        supabaseClient,
        request.sessionId,
        request.context.lastMessage,
        request.context
      );

      // Merge chat response with MCP response
      response = {
        ...response,
        data: {
          ...response.data,
          chatResponse: chatResponse
        }
      };
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const response: MCPResponse = {
      success: false,
      message: error.message,
      error: {
        type: 'VALIDATION_ERROR',
        message: error.message,
        details: error
      }
    };

    return new Response(JSON.stringify(response), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}); 