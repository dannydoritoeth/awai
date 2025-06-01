import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../shared/cors.ts';
import { 
  MCPResponse, 
  BaseMCPResponse,
  HiringMCPResponse,
  CandidateMCPResponse,
  AnalystMCPResponse
} from '../shared/types/mcpTypes.ts';
import {
  findCandidateMatches,
  findRoleMatches,
  generateChatResponse,
  generateRecommendations,
  determineNextActions
} from '../shared/mcp/matchingUtils.ts';
import { runCandidateLoop } from '../shared/mcp/candidate.ts';
import { runHiringLoop } from '../shared/mcp/hiring.ts';
import { runGeneralLoop } from '../shared/mcp/general.ts';
import { runAnalystLoop } from '../shared/mcp/analyst.ts';
import { embedContext } from '../shared/embeddings.ts';
import { getPlannerRecommendation } from '../shared/mcp/planner.ts';
import { logAgentAction } from '../shared/agent/logAgentAction.ts';
import { getConversationContextV2 } from '../shared/context/getConversationContext.ts';

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const request = await req.json();
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
    if (request.sessionId) {
      const retryCount = getRetryCount(request.sessionId);
      if (retryCount >= MAX_RETRIES) {
        throw new Error('Maximum retry attempts exceeded');
      }
      incrementRetryCount(request.sessionId);
    }

    // Get conversation context if session ID is provided
    let conversationContext;
    if (request.sessionId) {
      console.log('Getting conversation context...');
      try {
        conversationContext = await getConversationContextV2(supabaseClient, request.sessionId);
        // Merge conversation context into request context
        request.context = {
          ...request.context,
          chatHistory: conversationContext.history,
          agentActions: conversationContext.agentActions,
          contextEmbedding: conversationContext.contextEmbedding,
          summary: conversationContext.summary
        };
      } catch (error) {
        console.error('Error getting conversation context:', error);
        // Continue without context if there's an error
      }
    }

    // Get planner recommendations if message provided
    let plannerRecommendations = [];
    if (request.context?.lastMessage) {
      console.log('Getting planner recommendations...');
      try {
        plannerRecommendations = await getPlannerRecommendation(
          supabaseClient,
          {
            mode: request.mode,
            profileId: request.profileId,
            roleId: request.roleId,
            lastMessage: request.context.lastMessage,
            semanticContext: request.context.semanticContext,
            chatHistory: request.context.chatHistory,
            agentActions: request.context.agentActions,
            contextEmbedding: request.context.contextEmbedding,
            summary: request.context.summary
          }
        );
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
    let mcpResult;
    switch (request.mode) {
      case 'candidate':
        mcpResult = await runCandidateLoop(supabaseClient, {
          ...request,
          plannerRecommendations
        });
        break;
      case 'hiring':
        mcpResult = await runHiringLoop(supabaseClient, {
          ...request,
          plannerRecommendations
        });
        break;
      case 'analyst':
        mcpResult = await runAnalystLoop(supabaseClient, {
          ...request,
          context: {
            ...request.context,
            companyIds: request.companyIds, // Ensure companyIds is in context
            scope: request.scope || request.context?.scope || 'division',
            outputFormat: request.outputFormat || request.context?.outputFormat || 'action_plan'
          },
          plannerRecommendations
        });
        break;
      case 'general':
        mcpResult = await runGeneralLoop(supabaseClient, {
          ...request,
          plannerRecommendations
        });
        break;
      default:
        throw new Error(`Unsupported mode: ${request.mode}`);
    }

    // Format response using our new structure
    const baseResponse: BaseMCPResponse = {
      success: true,
      data: {
        matches: mcpResult.data?.matches || [],
        recommendations: mcpResult.data?.recommendations || [],
        chatResponse: mcpResult.data?.chatResponse || {
          message: 'No response generated',
          followUpQuestion: 'Would you like to try a different approach?'
        },
        nextActions: mcpResult.data?.nextActions || [],
        actionsTaken: [
          ...(mcpResult.data?.actionsTaken || []),
          'Retrieved conversation context',
          'Retrieved planner recommendations',
          `Executed ${request.mode} mode processing`,
          'Applied response formatting'
        ]
      }
    };

    // Add mode-specific data
    let response: MCPResponse;
    if (request.mode === 'hiring') {
      response = mcpResult as HiringMCPResponse;
    } else if (request.mode === 'candidate') {
      response = mcpResult as CandidateMCPResponse;
    } else if (request.mode === 'analyst') {
      response = mcpResult as AnalystMCPResponse;
    } else {
      response = mcpResult as BaseMCPResponse;
    }

    // Log actions for non-general modes
    if (response.success && response.data?.actionsTaken && request.mode !== 'general') {
      for (const action of response.data.actionsTaken) {
        if (typeof action === 'string') {
          await logAgentAction(supabaseClient, {
            entityType: request.mode === 'candidate' ? 'profile' : 'role',
            entityId: request.mode === 'candidate' ? request.profileId! : request.roleId!,
            payload: {
              action,
              reason: 'MCP Processing Step',
              result: null
            }
          });
        } else {
          await logAgentAction(supabaseClient, {
            entityType: request.mode === 'candidate' ? 'profile' : 'role',
            entityId: request.mode === 'candidate' ? request.profileId! : request.roleId!,
            payload: {
              action: action.tool,
              reason: action.reason,
              result: action.result
            }
          });
        }
      }
    }

    // Clear retry count on success
    if (request.sessionId) {
      clearRetryCount(request.sessionId);
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in MCP loop:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}); 