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
import { invokeChatModelV2 } from "../../../ai/invokeAIModelV2.ts";
import { logAgentProgress } from "../../../chatUtils.ts";
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// Input validation schema
const explainMatchSchema = z.object({
  profileId: z.string(),
  roleId: z.string(),
  mode: z.enum(['fit', 'diagnostic', 'feedback']).optional(),
  audience: z.enum(['manager', 'candidate', 'analyst']).optional()
});

interface ExplainMatchContext {
  profileId: string;
  roleId: string;
  mode?: 'fit' | 'diagnostic' | 'feedback';
  audience?: 'manager' | 'candidate' | 'analyst';
  sessionId?: string;
  supabase: SupabaseClient;
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

async function explainMatchAction(context: ExplainMatchContext): Promise<MCPResponse> {
  try {
    // Input validation
    const validatedInput = explainMatchSchema.parse(context);
    const { profileId, roleId, mode = 'fit', audience = 'manager', sessionId, supabase } = validatedInput;

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
    const [profileData, roleData, gapsData, fitData] = await Promise.all([
      // Get profile details
      supabase.from('profiles').select('id, name').eq('id', profileId).single(),
      // Get role details
      supabase.from('roles').select('id, title').eq('id', roleId).single(),
      // Get capability and skill gaps
      supabase.rpc('get_profile_role_gaps', { p_profile_id: profileId, p_role_id: roleId }),
      // Get fit score
      supabase.rpc('calculate_profile_role_fit', { p_profile_id: profileId, p_role_id: roleId })
    ]);

    if (!profileData.data || !roleData.data || !gapsData.data || !fitData.data) {
      throw new Error('Failed to fetch required data');
    }

    // Prepare AI context
    const aiContext: AIContext = {
      profileName: profileData.data.name,
      roleName: roleData.data.title,
      capabilityGaps: gapsData.data.capability_gaps,
      skillGaps: gapsData.data.skill_gaps,
      fitScore: fitData.data,
      mode,
      audience
    };

    // Build prompt based on mode and audience
    const prompt = await buildSafePrompt({
      context: aiContext,
      instruction: `Analyze the match between ${aiContext.profileName} and the ${aiContext.roleName} role. 
      ${mode === 'fit' ? 'Focus on overall fit and key strengths/weaknesses.' :
        mode === 'diagnostic' ? 'Provide detailed analysis of gaps and areas for improvement.' :
        'Offer constructive feedback and development suggestions.'}
      Tailor the response for a ${audience} audience.`,
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
    });

    // Generate explanation using AI
    const aiResponse = await invokeChatModelV2({
      system: "You are an expert at analyzing profile-role matches and providing clear, actionable insights.",
      user: prompt
    }, {
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
    const highlightsPrompt = `Extract 3-5 key highlights from this match analysis as bullet points: ${aiResponse.output}`;
    const highlightsResponse = await invokeChatModelV2({
      system: "Extract the most important points as bullet points starting with •",
      user: highlightsPrompt
    }, {
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
    const response: MCPResponse = {
      success: true,
      data: {
        message: aiResponse.output,
        keyHighlights: highlightsResponse.output.split('\n').filter(line => line.trim().startsWith('•')),
        reasoning: prompt // Include the reasoning/prompt for transparency
      },
      dataForDownstreamPrompt: {
        explainMatch: {
          dataSummary: aiResponse.output,
          keyHighlights: highlightsResponse.output.split('\n').filter(line => line.trim().startsWith('•')),
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
      }
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
      }
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
  actionFn: explainMatchAction,
  getDefaultArgs: (context: Record<string, any>) => ({
    profileId: context.profileId,
    roleId: context.roleId,
    mode: 'fit',
    audience: context.userRole || 'manager'
  })
}; 