import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../shared/cors.ts';
import { 
  MCPResponse, 
  BaseMCPResponse,
  HiringMCPResponse,
  CandidateMCPResponse,
  AnalystMCPResponse,
  NextAction
} from '../shared/types/mcpTypes.ts';
import { McpLoopRunner } from '../shared/mcp/mcp-loop-v2.ts';
import { generateEmbedding } from '../shared/semanticSearch.ts';
import { getConversationContextV2 } from '../shared/context/getConversationContext.ts';
import { invokeChatModel } from '../shared/ai/invokeAIModel.ts';
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const request = await req.json();
    console.log('MCP Loop V2 Request:', request);

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

    // Ensure messages array exists
    if (!request.messages) {
      request.messages = [];
    }

    // If there's a lastMessage in context but no messages array, add it as a message
    if (request.context?.lastMessage && request.messages.length === 0) {
      request.messages.push({
        id: `msg-${Date.now()}`,
        content: request.context.lastMessage,
        role: 'user',
        timestamp: new Date().toISOString()
      });
    }

    // Track retries if session ID provided
    if (request.sessionId) {
      const retryCount = getRetryCount(request.sessionId);
      if (retryCount >= MAX_RETRIES) {
        throw new Error('Maximum retry attempts exceeded');
      }
      incrementRetryCount(request.sessionId);
    }

    // Initialize McpLoopRunner with dependencies
    const runner = new McpLoopRunner(supabaseClient, request, {
      generateEmbedding,
      getConversationContext: getConversationContextV2,
      invokeChatModel
    });

    // Run the MCP loop
    const mcpResult = await runner.run();

    // Format response using our new structure
    const baseResponse: BaseMCPResponse = {
      success: mcpResult.success,
      error: mcpResult.error?.message,
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
        ],
        // Include V2 specific data
        intermediateResults: mcpResult.data?.intermediateResults || [],
        context: mcpResult.data?.context || {},
        plan: mcpResult.data?.plan || []
      }
    };

    // Add mode-specific data
    let response: MCPResponse;
    if (request.mode === 'hiring') {
      response = {
        ...baseResponse,
        data: {
          ...baseResponse.data,
          matchingProfiles: mcpResult.data?.context?.matchingProfiles || [],
          roleRequirements: mcpResult.data?.context?.roleRequirements || {},
          fitScores: mcpResult.data?.context?.fitScores || {}
        }
      } as HiringMCPResponse;
    } else if (request.mode === 'candidate') {
      response = {
        ...baseResponse,
        data: {
          ...baseResponse.data,
          careerPaths: mcpResult.data?.context?.careerPaths || [],
          skillGaps: mcpResult.data?.context?.skillGaps || [],
          developmentPlan: mcpResult.data?.context?.developmentPlan || {}
        }
      } as CandidateMCPResponse;
    } else if (request.mode === 'analyst') {
      response = {
        ...baseResponse,
        data: {
          ...baseResponse.data,
          analysis: mcpResult.data?.context?.analysis || {},
          heatmap: mcpResult.data?.context?.heatmap || {},
          trends: mcpResult.data?.context?.trends || {}
        }
      } as AnalystMCPResponse;
    } else {
      response = baseResponse;
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
              reason: 'MCP Processing Step V2',
              result: null
            }
          });
        } else {
          const nextAction = action as NextAction;
          await logAgentAction(supabaseClient, {
            entityType: request.mode === 'candidate' ? 'profile' : 'role',
            entityId: request.mode === 'candidate' ? request.profileId! : request.roleId!,
            payload: {
              action: nextAction.action,
              reason: nextAction.reason,
              result: nextAction.confidence
            }
          });
        }
      }

      // Also log intermediate results from V2
      if (mcpResult.data?.intermediateResults) {
        for (const result of mcpResult.data.intermediateResults) {
          await logAgentAction(supabaseClient, {
            entityType: request.mode === 'candidate' ? 'profile' : 'role',
            entityId: request.mode === 'candidate' ? request.profileId! : request.roleId!,
            payload: {
              action: result.tool,
              reason: 'MCP V2 Tool Execution',
              result: result.success ? result.output : result.error
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
    console.error('Error in MCP loop V2:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
