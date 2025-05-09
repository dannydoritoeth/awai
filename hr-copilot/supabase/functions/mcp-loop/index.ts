import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../shared/cors.ts';
import { MCPRequest, MCPResponse, MCPMode } from '../shared/mcpTypes.ts';
import { runCandidateLoop } from '../shared/mcp/candidate.ts';
import { runHiringLoop } from '../shared/mcp/hiring.ts';
import { runGeneralLoop } from '../shared/mcp/general.ts';
import { embedContext } from '../shared/embeddings.ts';
import { getPlannerRecommendation } from '../shared/mcp/planner.ts';
import { logAgentAction } from '../shared/agent/logAgentAction.ts';

// Initialize Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
);

// Constants for retry and error handling
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

// Track retries per session to prevent endless loops
const retryTracker = new Map<string, number>();

// Helper to get retry count
function getRetryCount(sessionId: string): number {
  return retryTracker.get(sessionId) || 0;
}

// Helper to increment retry count
function incrementRetryCount(sessionId: string): void {
  retryTracker.set(sessionId, getRetryCount(sessionId) + 1);
}

// Helper to clear retry count
function clearRetryCount(sessionId: string): void {
  retryTracker.delete(sessionId);
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const request: MCPRequest = await req.json();
    console.log('MCP Loop Request:', request);

    // Validate request
    if (!request.mode) {
      throw new Error('Mode is required');
    }

    if (request.mode === 'candidate' && !request.profileId) {
      throw new Error('Profile ID is required for candidate mode');
    }

    if (request.mode === 'hiring' && !request.roleId) {
      throw new Error('Role ID is required for hiring mode');
    }

    // Track retries if session ID provided
    let retryCount = 0;
    if (request.sessionId) {
      retryCount = getRetryCount(request.sessionId);
      if (retryCount >= MAX_RETRIES) {
        throw new Error('Maximum retry attempts exceeded');
      }
      retryTracker.set(request.sessionId, retryCount + 1);
    }

    // Get planner recommendations if message provided
    let plannerRecommendations = [];
    if (request.context?.lastMessage) {
      console.log('Getting planner recommendations...');
      try {
        const recommendations = await getPlannerRecommendation(
          supabaseClient,
          {
            mode: request.mode,
            profileId: request.profileId,
            roleId: request.roleId,
            lastMessage: request.context.lastMessage,
            semanticContext: request.context.semanticContext
          }
        );
        
        plannerRecommendations = recommendations;

        // Log planner decision for transparency
        if (request.mode !== 'general') {
          await logAgentAction(supabaseClient, {
            entityType: request.mode === 'candidate' ? 'profile' : 'role',
            entityId: request.mode === 'candidate' ? request.profileId! : request.roleId!,
            payload: {
              action: 'planner_decision',
              message: request.context.lastMessage,
              recommendations
            }
          });
        }

      } catch (error) {
        console.error('Planner error:', error);
        // Provide mode-specific fallback recommendations
        plannerRecommendations = request.mode === 'candidate' ? 
          [{ 
            tool: 'getSuggestedCareerPaths',
            reason: 'Fallback career path suggestions',
            confidence: 0.7,
            inputs: { profileId: request.profileId }
          }] : 
          request.mode === 'hiring' ?
          [{
            tool: 'getMatchingProfiles',
            reason: 'Fallback profile matching',
            confidence: 0.7,
            inputs: { roleId: request.roleId }
          }] :
          [{
            tool: 'analyzeSkillsAndCapabilities',
            reason: 'Fallback general analysis',
            confidence: 0.7,
            inputs: {}
          }];
      }
    }

    // Run the appropriate loop based on mode
    let response: MCPResponse;
    switch (request.mode) {
      case 'candidate':
        response = await runCandidateLoop(supabaseClient, {
          ...request,
          plannerRecommendations
        });
        break;
      case 'hiring':
        response = await runHiringLoop(supabaseClient, {
          ...request,
          plannerRecommendations
        });
        break;
      case 'general':
        response = await runGeneralLoop(supabaseClient, {
          ...request,
          plannerRecommendations
        });
        break;
      default:
        throw new Error(`Unsupported mode: ${request.mode}`);
    }

    // Log the actions taken for non-general modes
    if (response.success && response.data?.actionsTaken && request.mode !== 'general') {
      for (const action of response.data.actionsTaken) {
        await logAgentAction(supabaseClient, {
          entityType: request.mode === 'candidate' ? 'profile' : 'role',
          entityId: request.mode === 'candidate' ? request.profileId! : request.roleId!,
          payload: {
            action: action.tool,
            reason: action.reason,
            inputs: action.inputs,
            result: action.result
          }
        });
      }
    }

    // Clear retry count on success
    if (request.sessionId) {
      retryTracker.delete(request.sessionId);
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