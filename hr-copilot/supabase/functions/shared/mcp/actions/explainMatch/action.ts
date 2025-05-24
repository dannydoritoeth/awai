/**
 * @fileoverview Implements the explainMatch MCPActionV2 which generates narrative explanations
 * of profile-to-role or role-to-profile matches. This action analyzes capability gaps, skill gaps,
 * and overall fit scores to produce human-readable explanations tailored to different audiences
 * and purposes.
 * 
 * Key Features:
 * - Supports multiple explanation modes: fit assessment, diagnostic analysis, and feedback
 * - Adapts tone and content for different audiences: managers, candidates, and analysts
 * - Leverages AI to generate natural language explanations
 * - Provides structured output with key highlights and actionable insights
 * 
 * Dependencies:
 * - Requires prior execution of capability gap analysis
 * - Requires prior execution of skill gap analysis
 * - Requires prior execution of profile-role fit scoring
 * 
 * @see getCapabilityGaps
 * @see getSkillGaps
 * @see scoreProfileRoleFit
 */

import { z } from "https://deno.land/x/zod/mod.ts";
import { buildSafePrompt } from "../../promptBuilder.ts";
import { invokeChatModelV2, type ChatPrompt } from "../../../ai/invokeAIModelV2.ts";
import { logAgentProgress } from "../../../chatUtils.ts";
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js';
import { MCPActionV2, MCPResponse } from "../../types/action.ts";
import { PromptData } from "../../promptTypes.ts";

// Helper function to convert level strings to numeric values
function getLevelValue(level: string): number {
  const levelMap: Record<string, number> = {
    'None': 0,
    'Basic': 1,
    'Intermediate': 2,
    'Advanced': 3,
    'Expert': 4
  };
  return levelMap[level] || 0;
}

interface ProfileCapability {
  level: string | undefined;
  name: string;
  groupName: string;
}

// Input validation schema
const explainMatchSchema = z.object({
  profileId: z.string(),
  roleId: z.string(),
  mode: z.enum(['fit', 'diagnostic', 'feedback']).optional(),
  audience: z.enum(['manager', 'candidate', 'analyst']).optional(),
  sessionId: z.string().optional(),
  supabase: z.any() // Add supabase client to schema
});

interface ExplainMatchContext {
  profileId: string;
  roleId: string;
  mode?: 'fit' | 'diagnostic' | 'feedback';
  audience?: 'manager' | 'candidate' | 'analyst';
  sessionId?: string;
  supabase: SupabaseClient;
  downstreamData?: {
    getCapabilityGaps?: {
      dataSummary: string;
      structured: {
        gaps: Array<{
          name: string;
          currentLevel: number;
          requiredLevel: number;
          gap: number;
        }>;
      };
    };
    getSkillGaps?: {
      dataSummary: string;
      structured: {
        gaps: Array<{
          name: string;
          currentLevel: number;
          requiredLevel: number;
          gap: number;
        }>;
      };
    };
    scoreProfileRoleFit?: {
      dataSummary: string;
      structured: {
        score: {
          overall: number;
          breakdown: {
            capabilities: number;
            skills: number;
            experience: number;
          };
        };
      };
    };
  };
}

export interface AIContext {
  profileName: string;
  roleName: string;
  capabilityGaps: Array<{
    name: string;
    currentLevel: number;
    requiredLevel: number;
    gap: number;
  }>;
  skillGaps: Array<{
    name: string;
    currentLevel: number;
    requiredLevel: number;
    gap: number;
  }>;
  fitScore: {
    overall: number;
    breakdown: {
      capabilities: number;
      skills: number;
      experience: number;
    };
  };
  mode: 'fit' | 'diagnostic' | 'feedback';
  audience: 'manager' | 'candidate' | 'analyst';
}

// Update MCPResponse interface to include announcement
interface ExtendedMCPResponse extends MCPResponse {
  announcement?: string;
  actionPlan?: {
    tool: string;
    args: {
      profileId: string;
      roleId: string;
      mode?: string;
      audience?: string;
    };
    announcement: string;
  };
}

async function explainMatchAction(context: ExplainMatchContext): Promise<ExtendedMCPResponse> {
  try {
    // Input validation
    const validatedInput = explainMatchSchema.parse({
      ...context,
      supabase: context.supabase
    });
    const { profileId, roleId, mode = 'fit', audience = 'manager', sessionId, supabase } = validatedInput;

    // Create base announcement that will be used in both success and error cases
    let announcement = `I will analyze the match and provide a detailed explanation`;

    // Log progress
    if (sessionId) {
      await logAgentProgress(
        supabase,
        sessionId,
        "Analyzing match explanation...",
        { phase: 'start' }
      );
    }

    // Gather required data from previous actions
    try {
      // Get profile and role details first
      const [profileData, roleData] = await Promise.all([
        supabase.from('profiles').select('id, name').eq('id', profileId).single(),
        supabase.from('roles').select('id, title').eq('id', roleId).single()
      ]);

      // Log basic data results
      console.log('Basic data fetch results:', {
        hasProfileData: !!profileData?.data,
        hasRoleData: !!roleData?.data,
        profileId,
        roleId
      });

      // Check basic data first
      if (!profileData?.data) {
        throw new Error(`Failed to fetch profile data for ID: ${profileId}`);
      }
      if (!roleData?.data) {
        throw new Error(`Failed to fetch role data for ID: ${roleId}`);
      }

      // Get data from previous actions via context
      const capabilityGapsData = context.downstreamData?.getCapabilityGaps;
      const skillGapsData = context.downstreamData?.getSkillGaps;
      const fitScoreData = context.downstreamData?.scoreProfileRoleFit;

      // Log data availability
      console.log('Previous actions data:', {
        hasCapabilityGaps: !!capabilityGapsData,
        hasSkillGaps: !!skillGapsData,
        hasFitScore: !!fitScoreData
      });

      // Validate required data
      if (!capabilityGapsData?.dataSummary) {
        throw new Error('Capability gaps data not found. Please run getCapabilityGaps action first.');
      }
      if (!skillGapsData?.dataSummary) {
        throw new Error('Skill gaps data not found. Please run getSkillGaps action first.');
      }
      if (!fitScoreData?.dataSummary) {
        throw new Error('Fit score data not found. Please run scoreProfileRoleFit action first.');
      }

      // Prepare AI context
      const aiContext: AIContext = {
        profileName: profileData.data.name,
        roleName: roleData.data.title,
        capabilityGaps: capabilityGapsData.structured.gaps,
        skillGaps: skillGapsData.structured.gaps,
        fitScore: fitScoreData.structured.score,
        mode,
        audience
      };

      // Build prompt based on mode and audience
      const promptData: PromptData = {
        context: aiContext,
        userMessage: `Analyze the match between ${aiContext.profileName} and the ${aiContext.roleName} role. 
        ${mode === 'fit' ? 'Focus on overall fit and key strengths/weaknesses.' :
          mode === 'diagnostic' ? 'Provide detailed analysis of gaps and areas for improvement.' :
          'Offer constructive feedback and development suggestions.'}
        Tailor the response for a ${audience} audience.`,
        data: {
          examples: [
            {
              input: { fitScore: { overall: 0.85 }, capabilityGaps: [], skillGaps: [] },
              output: "Strong match with excellent capability alignment. No significant gaps identified."
            },
            {
              input: { fitScore: { overall: 0.45 }, capabilityGaps: [{ name: "Leadership", gap: 2 }] },
              output: "Notable gaps in leadership capabilities suggest development needs before role readiness."
            }
          ]
        }
      };

      const prompt = await buildSafePrompt('openai:gpt-4', promptData);

      // Generate explanation using AI
      const chatPrompt: ChatPrompt = {
        system: "You are an expert at analyzing profile-role matches and providing clear, actionable insights.",
        user: prompt.user
      };

      const aiResponse = await invokeChatModelV2(chatPrompt, {
        model: 'openai:gpt-4',
        temperature: 0.7,
        max_tokens: 500,
        supabase,
        sessionId: sessionId || 'default',
        actionType: 'explainMatch'
      });

      if (!aiResponse.success || !aiResponse.output) {
        throw new Error(`AI processing failed: ${aiResponse.error?.message || 'Unknown error'}`);
      }

      // Extract key highlights using a follow-up AI call
      const highlightsChatPrompt: ChatPrompt = {
        system: "Extract the most important points as bullet points starting with •",
        user: `Extract 3-5 key highlights from this match analysis as bullet points: ${aiResponse.output}`
      };

      const highlightsResponse = await invokeChatModelV2(highlightsChatPrompt, {
        model: 'openai:gpt-4',
        temperature: 0.3,
        max_tokens: 200,
        supabase,
        sessionId: sessionId || 'default',
        actionType: 'explainMatch_highlights'
      });

      if (!highlightsResponse.success || !highlightsResponse.output) {
        throw new Error(`AI highlights extraction failed: ${highlightsResponse.error?.message || 'Unknown error'}`);
      }

      // Structure the response
      const response: ExtendedMCPResponse = {
        success: true,
        data: {
          message: aiResponse.output,
          keyHighlights: highlightsResponse.output.split('\n').filter(line => line.trim().startsWith('•'))
        },
        dataForDownstreamPrompt: {
          explainMatch: {
            dataSummary: aiResponse.output,
            structured: {
              profileId,
              roleId,
              fitScore: aiContext.fitScore,
              mode,
              audience
            },
            truncated: false
          }
        },
        chatResponse: {
          message: aiResponse.output,
          followUpQuestion: "Would you like to see a development plan based on this analysis?",
          aiPrompt: "The user may want to explore specific gaps or get more detailed recommendations."
        },
        announcement: `I will explain how well ${profileData.data.name} matches with the ${roleData.data.title} role, focusing on ${mode === 'fit' ? 'overall fit' : mode === 'diagnostic' ? 'detailed analysis' : 'development feedback'} for a ${audience} audience.`
      };

      // Log completion
      if (sessionId) {
        await logAgentProgress(
          supabase,
          sessionId,
          "Match explanation analysis complete",
          { phase: 'complete' }
        );
      }

      return response;

    } catch (error) {
      console.error('Error in explainMatch:', error);
      return {
        success: false,
        error: {
          type: 'EXPLAIN_MATCH_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: error
        },
        announcement: `I encountered an error while trying to explain the match: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      };
    }

  } catch (error) {
    console.error('Error in explainMatch:', error);
    return {
      success: false,
      error: {
        type: 'EXPLAIN_MATCH_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error
      },
      announcement: `I encountered an error while trying to explain the match: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
    };
  }
}

// Export the MCPActionV2 implementation
export const explainMatch: MCPActionV2 = {
  id: 'explainMatch',
  title: 'Explain Match',
  description: 'Generate a narrative explanation of how well a profile aligns with a role, based on capability, skill, and fit scoring data.',
  applicableRoles: ['candidate', 'manager', 'analyst'],
  capabilityTags: ['Explainability', 'Transparency', 'AI Reasoning'],
  requiredInputs: ['profileId', 'roleId'],
  tags: ['explanation', 'narrative', 'ai', 'post-analysis'],
  recommendedAfter: ['getCapabilityGaps', 'getSkillGaps', 'scoreProfileRoleFit'],
  recommendedBefore: ['getDevelopmentPlan'],
  usesAI: true,
  argsSchema: explainMatchSchema,
  actionFn: async (context: Record<string, any>): Promise<ExtendedMCPResponse> => {
    // Cast the context to ExplainMatchContext
    const typedContext: ExplainMatchContext = {
      profileId: context.profileId,
      roleId: context.roleId,
      mode: context.mode,
      audience: context.audience,
      sessionId: context.sessionId,
      supabase: context.supabase,
      downstreamData: context.downstreamData
    };

    console.log('Starting explainMatch action with context:', {
      profileId: typedContext.profileId,
      roleId: typedContext.roleId,
      mode: typedContext.mode,
      audience: typedContext.audience,
      sessionId: typedContext.sessionId,
      hasDownstreamData: !!typedContext.downstreamData
    });

    // Get profile and role names for announcement before running main action
    let profileName = 'the profile';
    let roleTitle = 'the role';
    try {
      const [profileData, roleData] = await Promise.all([
        typedContext.supabase.from('profiles').select('name').eq('id', typedContext.profileId).single(),
        typedContext.supabase.from('roles').select('title').eq('id', typedContext.roleId).single()
      ]);

      if (profileData?.data?.name) profileName = profileData.data.name;
      if (roleData?.data?.title) roleTitle = roleData.data.title;
    } catch (error) {
      console.error('Error fetching names for announcement:', error);
    }

    // Create announcement before running main action
    const baseAnnouncement = `I will explain how well ${profileName} matches with the ${roleTitle} role, focusing on ${typedContext.mode === 'fit' ? 'overall fit' : typedContext.mode === 'diagnostic' ? 'detailed analysis' : 'development feedback'} for a ${typedContext.audience} audience.`;
    
    console.log('Generated announcement:', baseAnnouncement);

    // Create the action plan with announcement
    const actionPlan = {
      tool: 'explainMatch',
      args: {
        profileId: typedContext.profileId,
        roleId: typedContext.roleId,
        mode: typedContext.mode,
        audience: typedContext.audience
      },
      announcement: baseAnnouncement
    };

    console.log('Created action plan:', actionPlan);

    const result = await explainMatchAction(typedContext);
    
    // Ensure announcement is included in both the action plan and the result
    return {
      ...result,
      announcement: baseAnnouncement,
      actionPlan
    };
  },
  getDefaultArgs: (context: Record<string, any>) => ({
    profileId: context.profileId,
    roleId: context.roleId,
    mode: 'fit',
    audience: context.userRole || 'manager'
  })
}; 