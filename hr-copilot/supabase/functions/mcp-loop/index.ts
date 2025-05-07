import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../shared/cors.ts';
import { MCPRequest, MCPResponse, MCPMode } from '../shared/mcpTypes.ts';
import { runCandidateLoop } from '../shared/mcp/candidate.ts';
import { runHiringLoop } from '../shared/mcp/hiring.ts';
import { handleChatInteraction } from '../shared/mcp/chat.ts';
import { embedContext } from '../shared/mcp/embedding.ts';
import { getPlannerRecommendation } from '../shared/mcp/planner.ts';
import { logAgentAction } from '../shared/mcp/logger.ts';

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

    // Check and create embeddings if needed
    if (request.mode === 'candidate' && request.profileId) {
      const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('embedding')
        .eq('id', request.profileId)
        .single();

      if (!profile?.embedding) {
        console.log('Creating profile embedding...');
        await embedContext(supabaseClient, 'profile', request.profileId);
      }
    }

    if (request.mode === 'hiring' && request.roleId) {
      const { data: role, error } = await supabaseClient
        .from('roles')
        .select('embedding')
        .eq('id', request.roleId)
        .single();

      if (!role?.embedding) {
        console.log('Creating role embedding...');
        await embedContext(supabaseClient, 'role', request.roleId);
      }
    }

    // Get AI planner recommendations if there's a message
    let plannerRecommendations = null;
    if (request.context?.lastMessage) {
      console.log('Getting planner recommendations...');
      plannerRecommendations = await getPlannerRecommendation(
        request.context.lastMessage,
        request.mode === 'candidate' ? [
          'getSuggestedCareerPaths',
          'getJobReadiness',
          'getOpenJobs',
          'getCapabilityGaps',
          'getSkillGaps'
        ] : [
          'getMatchingProfiles',
          'scoreProfileFit',
          'getCapabilityGaps',
          'getSkillGaps'
        ],
        {
          mode: request.mode,
          profileId: request.profileId,
          roleId: request.roleId,
          semanticContext: request.context.semanticContext
        }
      );
    }

    // Run the appropriate loop based on mode
    let response: MCPResponse;
    if (request.mode === 'candidate') {
      response = await runCandidateLoop(supabaseClient, {
        ...request,
        plannerRecommendations
      });
    } else {
      response = await runHiringLoop(supabaseClient, {
        ...request,
        plannerRecommendations
      });
    }

    // Log the actions taken
    if (response.success && response.data?.actionsTaken) {
      for (const action of response.data.actionsTaken) {
        await logAgentAction(supabaseClient, {
          agentName: 'mcp-planner',
          actionType: action.tool,
          targetType: request.mode === 'candidate' ? 'profile' : 'role',
          targetId: request.mode === 'candidate' ? request.profileId : request.roleId,
          outcome: action.result,
          payload: {
            reason: action.reason,
            inputs: action.inputs
          },
          confidenceScore: action.confidence || 0.8,
          sessionId: request.sessionId
        });
      }
    }

    // Handle chat interaction if there's a message
    if (request.context?.lastMessage && request.sessionId) {
      await handleChatInteraction(
        supabaseClient,
        request.sessionId,
        request.context.lastMessage,
        {
          mode: request.mode,
          profileId: request.profileId,
          roleId: request.roleId,
          actionsTaken: response.data?.actionsTaken || []
        }
      );
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('MCP Loop Error:', error);
    
    const response: MCPResponse = {
      success: false,
      message: error.message,
      error: {
        type: error.type || 'INTERNAL_ERROR',
        message: error.message,
        details: error
      }
    };

    return new Response(JSON.stringify(response), {
      status: error.type === 'VALIDATION_ERROR' ? 400 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}); 