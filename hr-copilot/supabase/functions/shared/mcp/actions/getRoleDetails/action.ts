import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../../database.types.ts';
import { MCPActionV2, MCPRequest, MCPResponse } from '../../types/action.ts';
import { getRoleDetail, RoleDetail } from '../../../role/getRoleDetail.ts';
import { buildPromptInput } from './buildPrompt.ts';
import { invokeChatModel } from '../../../ai/invokeAIModel.ts';
import { buildSafePrompt } from '../../../ai/buildSafePrompt.ts';
import { logAgentAction } from '../../../agent/logAgentAction.ts';
import { logAgentResponse } from '../../../chatUtils.ts';

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

interface GetRoleDetailsArgs {
  roleId: string;
}

async function getRoleDetailsBase(request: MCPRequest): Promise<MCPResponse> {
  try {
    const args = request as GetRoleDetailsArgs;
    
    // Debug logging for incoming request
    console.log('getRoleDetails request:', {
      args,
      contextKeys: Object.keys(request),
      roleId: request.roleId, // Direct from request
      contextRoleId: request.context?.roleId, // From context
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

    // Log data gathering step
    logAgentResponse(request.sessionId, 'data_gathered', 'Fetching role details...');
    console.log('Fetching role details for:', {
      roleId: args.roleId,
      sessionId: request.sessionId
    });

    // Get role details from database
    const roleDetailResponse = await getRoleDetail(request.supabase as SupabaseClient<Database>, args.roleId);
    
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
    logAgentResponse(request.sessionId, 'prompt_built', 'Analyzing role details...');
    const promptInput = buildPromptInput(context);
    const safePrompt = buildSafePrompt(promptInput);

    // Invoke AI
    logAgentResponse(request.sessionId, 'ai_invoked', 'Generating role insights...');
    const aiResponse = await invokeChatModel({
      system: safePrompt.system,
      user: safePrompt.user
    }, {
      model: 'openai:gpt-3.5-turbo',
      temperature: 0.2,
      max_tokens: 1500
    });

    logAgentResponse(request.sessionId, 'response_received', 'Processing role analysis...');

    // Structure the final response
    const response: MCPResponse = {
      success: true,
      data: {
        role: roleDetailResponse.data,
        analysis: aiResponse.choices[0].message.content
      },
    };

    // Log the action
    await logAgentAction(request.supabase, {
      type: 'getRoleDetails',
      data: context,
      prompt: safePrompt,
      result: aiResponse
    });

    return response;

  } catch (error) {
    console.error('getRoleDetails unexpected error:', error);
    return {
      success: false,
      error: {
        type: 'ACTION_ERROR',
        message: 'Failed to get role details',
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
  recommendedAfter: [],
  recommendedBefore: ['getCapabilityGaps', 'getDevelopmentPlan'],
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
      roldId: context.roldId, // Check for typo
      context: context.context
    });
    return {
      roleId: context.roleId
    };
  }
};

export default getRoleDetails;
