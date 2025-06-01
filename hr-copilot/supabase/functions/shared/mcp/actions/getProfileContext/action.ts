/**
 * @fileoverview Gets detailed context about a profile including skills, capabilities, and career path
 * 
 * Purpose: Retrieves comprehensive information about a profile to provide context for
 * other actions and AI interactions.
 * 
 * Inputs:
 * - profileId: ID of the profile to get context for
 * 
 * Outputs:
 * - Profile details including skills and capabilities
 * - Career path information
 * - Recent job interactions
 * 
 * Related Actions:
 * - getCapabilityGaps: Uses profile context for analysis
 * - getSkillRecommendations: Uses profile context for recommendations
 * - getDevelopmentPlan: Uses profile context for planning
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../../database.types.ts';
import { MCPActionV2, MCPRequest, MCPResponse } from '../../types/action.ts';
import { getProfileContext } from '../../../profile/getProfileContext.ts';
import { buildPromptInput } from './buildPrompt.ts';
import { buildSafePrompt } from '../../../ai/buildSafePrompt.ts';
import { invokeChatModelV2 } from '../../../ai/invokeAIModelV2.ts';
import { logAgentProgress } from '../../../chatUtils.ts';
import { ActionButtons } from '../../../utils/markdown/renderMarkdownActionButton.ts';
import { z } from "https://deno.land/x/zod/mod.ts";

const profileContextSchema = z.object({
  profileId: z.string()
});

interface GetProfileContextArgs extends MCPRequest {
  profileId: string;
}

async function getProfileContextBase(request: MCPRequest): Promise<MCPResponse> {
  try {
    const args = request as GetProfileContextArgs;
    const supabase = request.supabase as SupabaseClient<Database>;
    
    // Debug logging for incoming request
    console.log('getProfileContext request:', {
      requestId: request.id,
      sessionId: request.sessionId,
      args,
      contextKeys: Object.keys(request),
      profileId: request.profileId,
      timestamp: new Date().toISOString()
    });

    if (!args.profileId) {
      console.error('getProfileContext failed: No profileId provided', {
        args,
        request: {
          profileId: request.profileId,
          context: request.context
        }
      });
      return {
        success: false,
        error: {
          type: 'INVALID_INPUT',
          message: 'profileId is required'
        }
      };
    }

    // Get profile details from database
    const profileContextResponse = await getProfileContext(supabase, args.profileId);
    
    if (!profileContextResponse.data) {
      console.error('getProfileContext database error:', {
        error: profileContextResponse.error,
        profileId: args.profileId
      });
      return {
        success: false,
        error: profileContextResponse.error || {
          type: 'NOT_FOUND',
          message: 'Profile details not found'
        }
      };
    }

    // Add profile details to context
    const context = {
      profileId: args.profileId,
      profileContext: profileContextResponse.data
    };

    // Build AI prompt
    const promptInput = buildPromptInput(context);
    const safePrompt = buildSafePrompt(promptInput);

    // Generate profile analysis
    const aiResponse = await invokeChatModelV2(safePrompt, {
      model: 'openai:gpt-3.5-turbo',
      temperature: 0.7,
      max_tokens: 1000,
      supabase,
      sessionId: request.sessionId || 'default',
      actionType: 'getProfileContext'
    });

    if (!aiResponse.success || !aiResponse.output) {
      throw new Error(`AI processing failed: ${aiResponse.error?.message || 'Unknown error'}`);
    }

    // Log progress if we have a session
    if (request.sessionId) {
      await logAgentProgress(
        supabase,
        request.sessionId,
        aiResponse.output,
        { 
          phase: 'complete',
          analysisDetails: {
            message: aiResponse.output
          }
        }
      );
    }

    // Add action buttons to the response
    const finalOutput = `${aiResponse.output}

${ActionButtons.profileExplorationGroup(args.profileId, '', profileContextResponse.data.profile.name, {
  profileId: args.profileId,
  name: profileContextResponse.data.profile.name,
  semanticScore: 1,
  currentRole: profileContextResponse.data.careerPath?.current_role
})}`;

    // Structure the final response
    const response: MCPResponse = {
      success: true,
      data: {
        structured: {
          profileId: args.profileId,
          name: profileContextResponse.data.profile.name,
          skills: profileContextResponse.data.profile.skills,
          capabilities: profileContextResponse.data.profile.capabilities,
          careerPath: profileContextResponse.data.careerPath
        },
        raw: finalOutput
      },
      dataForDownstreamPrompt: {
        getProfileContext: {
          dataSummary: aiResponse.output,
          structured: {
            profileId: args.profileId,
            name: profileContextResponse.data.profile.name,
            currentRole: profileContextResponse.data.careerPath?.current_role,
            targetRole: profileContextResponse.data.careerPath?.target_role,
            hasAiAnalysis: true
          },
          truncated: false
        }
      }
    };

    return response;

  } catch (error) {
    if (request.sessionId) {
      await logAgentProgress(
        supabase,
        request.sessionId,
        'Error retrieving profile details. Please try again.',
        { phase: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }

    return {
      success: false,
      error: {
        type: 'PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error
      }
    };
  }
}

// Create the MCPActionV2 implementation
export const getProfileContextAction: MCPActionV2 = {
  id: 'getProfileContext',
  title: 'Get Profile Context',
  description: 'Retrieve and analyze detailed information about a specific profile',
  applicableRoles: ['candidate', 'manager', 'hr'],
  capabilityTags: ['Career Development', 'Profile Analysis'],
  requiredInputs: ['profileId'],
  tags: ['profile', 'analysis', 'career'],
  suggestedPrerequisites: [],
  suggestedPostrequisites: ['getCapabilityGaps', 'getDevelopmentPlan'],
  usesAI: true,
  argsSchema: profileContextSchema,
  actionFn: (ctx: Record<string, any>) => {
    return getProfileContextBase(ctx as MCPRequest);
  },
  getDefaultArgs: (context: Record<string, any>) => {
    return {
      profileId: context.profileId || context.context?.profileId
    };
  }
};

export default getProfileContextAction; 