import { z } from "https://deno.land/x/zod/mod.ts";
import { MCPActionV2, MCPRequest, MCPResponse } from '../../types/action.ts';
import { invokeChatModelV2 } from '../../../ai/invokeAIModelV2.ts';
import { getProfileData } from '../../../profile/getProfileData.ts';
import { getRoleDetail } from '../../../role/getRoleDetail.ts';
import { getRoleTransitions } from '../getRoleTransitions/action.ts';
import { buildSafeTransitionSuggestionsPrompt, AIContext } from './buildPrompt.ts';
import { logAgentProgress } from '../../../chatUtils.ts';

// Schema for action arguments
const argsSchema = z.object({
  roleId: z.string().uuid()
    .describe("Role ID to get transition suggestions for"),
  profileId: z.string().uuid().optional()
    .describe("Optional profile ID to personalize suggestions"),
  maxSuggestions: z.number().optional()
    .describe("Maximum number of suggestions to return"),
  considerFactors: z.object({
    skills: z.boolean().optional(),
    experience: z.boolean().optional(),
    qualifications: z.boolean().optional(),
    interests: z.boolean().optional(),
    careerGoals: z.boolean().optional()
  }).optional()
    .describe("Factors to consider in suggestions")
});

type Args = z.infer<typeof argsSchema>;

interface ActionContext {
  profileData?: any;
  roleData: any;
  existingTransitions: any[];
  sessionId?: string;
  downstreamData?: any;
}

export const getPossibleTransitions: MCPActionV2 = {
  id: 'getPossibleTransitions',
  title: 'Get Possible Role Transitions',
  description: 'Use AI to suggest possible role transitions based on skills and experience',
  applicableRoles: ['public', 'candidate', 'hiring', 'analyst'],
  capabilityTags: ['roles', 'transitions', 'ai'],
  requiredInputs: [],
  tags: ['roles', 'transitions', 'ai', 'suggestions'],
  usesAI: true,
  argsSchema,
  suggestedPrerequisites: ['getRole', 'getRoleTransitions'],
  suggestedPostrequisites: ['getTransitionRequirements'],

  getDefaultArgs: (context) => ({
    maxSuggestions: 5,
    considerFactors: {
      skills: true,
      experience: true,
      qualifications: true,
      interests: true,
      careerGoals: true
    }
  }),

  actionFn: async (ctx: Record<string, any>): Promise<MCPResponse> => {
    try {
      const { supabase } = ctx;
      const args = ctx.args as Args;
      const sessionId = ctx.sessionId;

      // Load role data
      const roleDetailResponse = await getRoleDetail(supabase, args.roleId);
      if (!roleDetailResponse.success || !roleDetailResponse.data) {
        throw new Error('Could not fetch role data');
      }
      const roleData = roleDetailResponse.data;

      // Load profile data if provided
      let profileData = null;
      if (args.profileId) {
        profileData = await getProfileData(supabase, args.profileId);
        if (!profileData) {
          throw new Error('Could not fetch profile data');
        }
      }

      // Get existing transitions
      const transitionsResponse = await getRoleTransitions.actionFn({
        supabase,
        roleId: args.roleId,
        direction: 'from',
        includeRequirements: true,
        context: {}
      });

      if (!transitionsResponse.success || !transitionsResponse.data) {
        throw new Error('Could not fetch existing transitions');
      }

      // Prepare context for AI processing
      const context: ActionContext = {
        profileData,
        roleData,
        existingTransitions: transitionsResponse.data.transitions,
        sessionId,
        downstreamData: ctx.context?.downstreamData
      };

      // Build AI prompt
      const aiContext: AIContext = {
        currentRole: {
          title: roleData.title,
          division: roleData.division,
          skills: roleData.skills.map((s: any) => ({
            name: s.name,
            level: s.level
          })),
          capabilities: roleData.capabilities.map((c: any) => ({
            name: c.name,
            type: c.type,
            level: c.level
          }))
        },
        personProfile: profileData ? {
          skills: profileData.skills.map((s: any) => ({
            name: s.name,
            level: s.level,
            years: s.years
          })),
          qualifications: profileData.qualifications.map((q: any) => ({
            name: q.name,
            type: q.type
          })),
          interests: profileData.interests.map((i: any) => ({
            name: i.name
          })),
          career_goals: profileData.career_goals.map((g: any) => ({
            goal: g.goal,
            priority: g.priority
          }))
        } : undefined,
        existingTransitions: context.existingTransitions.map((t: any) => ({
          to_role: {
            title: t.to_role.title,
            division: t.to_role.division,
            skills: t.to_role.skills.map((s: any) => ({
              name: s.name,
              level: s.level
            })),
            capabilities: t.to_role.capabilities.map((c: any) => ({
              name: c.name,
              type: c.type,
              level: c.level
            }))
          },
          frequency: t.frequency,
          success_rate: t.success_rate
        })),
        considerFactors: args.considerFactors || {
          skills: true,
          experience: true,
          qualifications: true,
          interests: true,
          careerGoals: true
        }
      };

      const prompt = buildSafeTransitionSuggestionsPrompt(aiContext);

      // Generate suggestions
      const aiResponse = await invokeChatModelV2(prompt, {
        model: 'openai:gpt-3.5-turbo',
        temperature: 0.2,
        max_tokens: 2000,
        supabase,
        sessionId: sessionId || 'default',
        actionType: 'getPossibleTransitions'
      });

      if (!aiResponse.success || !aiResponse.output) {
        throw new Error(`AI processing failed: ${aiResponse.error?.message || 'Unknown error'}`);
      }

      // Log progress if we have a session
      if (sessionId) {
        await logAgentProgress(
          supabase,
          sessionId,
          aiResponse.output,
          {
            phase: 'complete',
            analysisDetails: {
              message: aiResponse.output
            }
          }
        );
      }

      return {
        success: true,
        data: {
          structured: {},
          raw: aiResponse.output
        }
      };

    } catch (error) {
      console.error('Error in getPossibleTransitions:', error);
      
      if (ctx.sessionId) {
        await logAgentProgress(
          ctx.supabase,
          ctx.sessionId,
          "I encountered an error while analyzing possible transitions. Let me know if you'd like to try again.",
          {
            phase: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      }

      return {
        success: false,
        error: {
          type: 'ActionError',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}; 