import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../../database.types.ts';
import { MCPActionV2, MCPRequest, MCPResponse } from '../../types/action.ts';
import { getRoleDetail } from '../../../role/getRoleDetail.ts';
import { buildPromptInput } from './buildPrompt.ts';
import { buildSafePrompt } from '../../../ai/buildSafePrompt.ts';
import { invokeChatModelV2 } from '../../../ai/invokeAIModelV2.ts';
import { logAgentProgress } from '../../../chatUtils.ts';

/**
 * getRoleDetails Action
 * 
 * Purpose: Retrieves detailed information about a role and generates a natural language
 * description of the role's responsibilities, requirements, and context.
 * 
 * Inputs:
 * - roleId: string (required) - The ID of the role to get details for
 * 
 * Outputs:
 * - output: Structured description of the role
 * - explanation: Natural language summary of the role
 * - rawAiResponse: Full AI response for debugging
 * 
 * Related Actions:
 * - getCapabilityGaps
 * - getDevelopmentPlan
 */

interface GetRoleDetailsArgs extends MCPRequest {
  roleId: string;
}

async function getRoleDetailsBase(request: MCPRequest): Promise<MCPResponse> {
  try {
    const args = request as GetRoleDetailsArgs;
    const supabase = request.supabase as SupabaseClient<Database>;
    
    // Debug logging for incoming request
    console.log('getRoleDetails request:', {
      requestId: request.id,
      sessionId: request.sessionId,
      args,
      contextKeys: Object.keys(request),
      roleId: request.roleId, // Direct from request
      contextRoleId: request.context?.roleId, // From context
      stack: new Error().stack,
      timestamp: new Date().toISOString(),
      rawRequest: request // Full request for debugging
    });

    if (!args.roleId) {
      console.error('getRoleDetails failed: No roleId provided', {
        args,
        request: {
          roleId: request.roleId,
          context: request.context
        }
      });
      return {
        success: false,
        error: {
          type: 'INVALID_INPUT',
          message: 'roleId is required'
        }
      };
    }

    // Get role details from database
    const roleDetailResponse = await getRoleDetail(supabase, args.roleId);
    
    if (roleDetailResponse.error || !roleDetailResponse.data) {
      console.error('getRoleDetails database error:', {
        error: roleDetailResponse.error,
        roleId: args.roleId
      });
      return {
        success: false,
        error: roleDetailResponse.error || {
          type: 'NOT_FOUND',
          message: 'Role details not found'
        }
      };
    }

    // Add role details to context
    const context = {
      roleId: args.roleId,
      roleDetail: roleDetailResponse.data
    };

    // Build AI prompt
    const promptInput = buildPromptInput(context);
    const safePrompt = buildSafePrompt(promptInput);

    // Generate role analysis
    const aiResponse = await invokeChatModelV2(safePrompt, {
      model: 'openai:gpt-3.5-turbo',
      temperature: 0.7,
      max_tokens: 1000,
      supabase,
      sessionId: request.sessionId || 'default',
      actionType: 'getRoleDetails'
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

    // Structure the final response
    const response: MCPResponse = {
      success: true,
      data: {
        structured: {
          roleId: roleDetailResponse.data.roleId,
          title: roleDetailResponse.data.title || roleDetailResponse.data.name,
          division: roleDetailResponse.data.divisionName || 'Not specified',
          capabilities: roleDetailResponse.data.capabilities
        },
        raw: aiResponse.output
      },
      dataForDownstreamPrompt: {
        getRoleDetails: {
          dataSummary: aiResponse.output,
          structured: {
            roleId: args.roleId,
            title: roleDetailResponse.data.title || roleDetailResponse.data.name,
            department: roleDetailResponse.data.department,
            level: roleDetailResponse.data.level,
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
        'Error retrieving role details. Please try again.',
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
export const getRoleDetails: MCPActionV2 = {
  id: 'getRoleDetails',
  title: 'Get Role Details',
  description: 'Retrieve and analyze detailed information about a specific role',
  applicableRoles: ['candidate', 'manager', 'hr'],
  capabilityTags: ['Career Development', 'Role Analysis'],
  requiredInputs: ['roleId'],
  tags: ['role', 'analysis', 'career'],
  suggestedPrerequisites: [],
  suggestedPostrequisites: ['getCapabilityGaps', 'getDevelopmentPlan'],
  usesAI: true,
  actionFn: (ctx: Record<string, any>) => {
    // Debug logging for context passed to actionFn
    console.log('getRoleDetails actionFn called with:', {
      contextKeys: Object.keys(ctx),
      roleId: ctx.roleId,
      context: ctx.context
    });
    return getRoleDetailsBase(ctx as MCPRequest);
  },
  getDefaultArgs: (context: Record<string, any>) => {
    // Debug logging for getDefaultArgs
    console.log('getRoleDetails getDefaultArgs called with:', {
      contextKeys: Object.keys(context),
      roleId: context.roleId,
      context: context.context
    });
    return {
      roleId: context.roleId
    };
  }
};

export default getRoleDetails;
