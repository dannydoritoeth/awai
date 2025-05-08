import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../shared/cors.ts';
import { MCPRequest, MCPResponse, MCPMode } from '../shared/mcpTypes.ts';
import { runCandidateLoop } from '../shared/mcp/candidate.ts';
import { runHiringLoop } from '../shared/mcp/hiring.ts';
import { handleChatInteraction } from '../shared/chatUtils.ts';
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
    const sessionId = request.sessionId || 'default';

    // Check retry count
    if (getRetryCount(sessionId) >= MAX_RETRIES) {
      clearRetryCount(sessionId); // Reset for next attempt
      throw new Error('Max retries exceeded. Please try again later.');
    }

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
    try {
      if (request.mode === 'candidate' && request.profileId) {
        const { data: profile, error } = await supabaseClient
          .from('profiles')
          .select('embedding')
          .eq('id', request.profileId)
          .single();

        if (!profile?.embedding) {
          console.log('Creating profile embedding...');
          const success = await embedContext(supabaseClient, 'profile', request.profileId);
          if (!success) {
            throw new Error('Failed to create profile embedding');
          }
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
          const success = await embedContext(supabaseClient, 'role', request.roleId);
          if (!success) {
            throw new Error('Failed to create role embedding');
          }
        }
      }
    } catch (error) {
      console.error('Embedding creation error:', error);
      throw new Error(`Failed to ensure embeddings: ${error.message}`);
    }

    // Get AI planner recommendations if there's a message
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
        await logAgentAction(supabaseClient, {
          entityType: request.mode === 'candidate' ? 'profile' : 'role',
          entityId: request.mode === 'candidate' ? request.profileId! : request.roleId!,
          payload: {
            action: 'planner_decision',
            message: request.context.lastMessage,
            recommendations
          }
        });

      } catch (error) {
        console.error('Planner error:', error);
        // Provide fallback recommendations if planner fails
        plannerRecommendations = request.mode === 'candidate' ? 
          [{ 
            tool: 'getSuggestedCareerPaths',
            reason: 'Fallback career path suggestions',
            confidence: 0.7,
            inputs: { profileId: request.profileId }
          }] : 
          [{
            tool: 'getMatchingProfiles',
            reason: 'Fallback profile matching',
            confidence: 0.7,
            inputs: { roleId: request.roleId }
          }];
      }
    }

    // Run the appropriate loop based on mode
    let response: MCPResponse;
    try {
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

      // Clear retry count on success
      clearRetryCount(sessionId);

    } catch (error) {
      console.error(`${request.mode} loop error:`, error);
      incrementRetryCount(sessionId);
      
      // If we haven't exceeded retries, throw to trigger retry
      if (getRetryCount(sessionId) < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        throw error;
      }
      
      // If we've exceeded retries, return a failure response
      return new Response(JSON.stringify({
        success: false,
        message: `Failed to complete ${request.mode} loop after ${MAX_RETRIES} attempts`,
        error: {
          type: 'LOOP_ERROR',
          message: error.message,
          details: error
        }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Log the actions taken
    if (response.success && response.data?.actionsTaken) {
      for (const action of response.data.actionsTaken) {
        await logAgentAction(supabaseClient, {
          entityType: request.mode === 'candidate' ? 'profile' : 'role',
          entityId: request.mode === 'candidate' ? request.profileId! : request.roleId!,
          payload: {
            action: action.tool,
            reason: action.reason,
            inputs: action.inputs,
            result: action.result
          },
          confidenceScore: action.confidence || 0.8,
          semanticMetrics: response.data.semanticMetrics
        });
      }
    }

    // Handle chat interaction if there's a message
    if (request.context?.lastMessage) {
      try {
        const chatResponse = await handleChatInteraction(
          supabaseClient,
          request.sessionId,
          request.context.lastMessage,
          {
            mode: request.mode,
            profileId: request.profileId,
            roleId: request.roleId,
            actionsTaken: response.data?.actionsTaken || [],
            candidateContext: {
              matches: response.data?.matches || [],
              recommendations: response.data?.recommendations || [],
              nextActions: response.data?.nextActions
            }
          }
        );

        // Include chat response in the final response
        response.data = {
          ...response.data,
          chatResponse: {
            message: chatResponse.response,
            followUpQuestion: chatResponse.followUpQuestion
          }
        };

      } catch (error) {
        console.error('Chat interaction error:', error);
        // Include a fallback response if chat generation fails
        response.data = {
          ...response.data,
          chatResponse: {
            message: "I processed your request but encountered an error generating a detailed response. Please try again.",
            followUpQuestion: null
          }
        };
      }
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