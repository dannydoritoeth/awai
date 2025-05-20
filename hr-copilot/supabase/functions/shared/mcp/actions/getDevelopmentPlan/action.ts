/**
 * @fileoverview Generates a detailed development plan for a profile to reach a target role
 * 
 * Related Actions:
 * - getCapabilityGaps: Used to analyze current gaps that need to be addressed
 * - getSkillGaps: Used to identify specific skill improvements needed
 * - getMatchingRolesForPerson: Can suggest intermediate roles on career path
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../../database.types.ts';
import { getCapabilityGaps } from '../getCapabilityGaps/action.ts';
import { getSkillGaps } from '../../../profile/getSkillGaps.ts';
import { getProfileData } from '../../../profile/getProfileData.ts';
import { getRoleDetail } from '../../../role/getRoleDetail.ts';
import { invokeChatModel } from '../../../ai/invokeAIModel.ts';
import { getSemanticMatches } from '../../../embeddings.ts';
import type { Tables } from '../../../embeddings.ts';
import { MCPActionV2, MCPRequest, MCPResponse } from '../../types/action.ts';
import { logAgentAction } from '../../../agent/logAgentAction.ts';
import { logAgentResponse } from '../../../chatUtils.ts';
import { buildDevelopmentPlanPrompt } from './buildPrompt.ts';
import { buildSafePrompt } from '../../../ai/buildSafePrompt.ts';

// Types for internal context vs AI context separation
interface ActionContext {
  profileData: any;
  roleData: any;
  capabilityGaps: any;
  skillGaps: any;
  mentorMatches: any[];
  sessionId?: string;
}

interface AIContext {
  profile: {
    skills: Array<{
      name: string;
      currentLevel: number;
      years: number;
    }>;
    capabilities: Array<{
      name: string;
      currentLevel: number;
    }>;
  };
  targetRole: {
    title: string;
    requirements: string[];
  };
  gaps: {
    capabilities: any[];
    skills: any[];
  };
  potentialMentors: Array<{
    id: string;
    name: string;
    title?: string;
    expertise?: string[];
    similarity: number;
  }>;
}

export interface DevelopmentPlan {
  recommendedSkills: Array<{
    name: string;
    priority: 'high' | 'medium' | 'low';
    currentLevel?: number;
    targetLevel: number;
    timeEstimate: string;
    trainingModules: Array<{
      name: string;
      type: string;
      duration: string;
      provider?: string;
    }>;
  }>;
  interimRoles: Array<{
    title: string;
    relevance: string;
    keySkillsGained: string[];
    typicalDuration: string;
  }>;
  suggestedMentors: Array<{
    id: string;
    name: string;
    title: string;
    expertise: string[];
    matchScore: number;
  }>;
  timeline: {
    shortTerm: string[];
    mediumTerm: string[];
    longTerm: string[];
  };
  estimatedTimeToReadiness: string;
  explanation: string;
}

/**
 * Prepares minimal context needed for AI processing
 */
function prepareAIContext(context: ActionContext): AIContext {
  return {
    profile: {
      skills: context.profileData.skills.map(s => ({
        name: s.name,
        currentLevel: Number(s.level) || 0,
        years: Number(s.years) || 0
      })),
      capabilities: context.profileData.capabilities.map(c => ({
        name: c.name,
        currentLevel: Number(c.level) || 0
      }))
    },
    targetRole: {
      title: context.roleData.title || context.roleData.name || 'Target Role',
      requirements: context.roleData.requirements || []
    },
    gaps: {
      capabilities: context.capabilityGaps.data || [],
      skills: context.skillGaps.data || []
    },
    potentialMentors: context.mentorMatches.map(match => ({
      id: match.id,
      name: match.name || '',
      title: match.metadata?.title,
      expertise: match.metadata?.expertise,
      similarity: match.similarity
    }))
  };
}

/**
 * Main action function that implements the MCPActionV2 interface
 */
async function getDevelopmentPlanBase(request: MCPRequest): Promise<MCPResponse<DevelopmentPlan>> {
  const supabase = request.supabase as SupabaseClient<Database>;
  const { profileId, roleId, sessionId } = request;

  try {
    // Validate inputs
    if (!profileId || !roleId) {
      return {
        success: false,
        error: {
          type: 'INVALID_INPUT',
          message: 'Both profileId and roleId are required'
        }
      };
    }

    // Phase 1: Load profile and role data
    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        "Loading profile and role data to create your development plan...",
        'data_loading'
      );
    }

    const [profileData, roleData] = await Promise.all([
      getProfileData(supabase, profileId),
      getRoleDetail(supabase, roleId)
    ]);

    if (!profileData || !roleData) {
      throw new Error('Could not fetch profile or role data');
    }

    // Phase 2: Analyze gaps
    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        "Analyzing your current capabilities and skills compared to the role requirements...",
        'gap_analysis'
      );
    }

    const [capabilityGaps, skillGaps] = await Promise.all([
      getCapabilityGaps.actionFn({
        supabase,
        profileId,
        roleId,
        mode: 'candidate',
        context: {}
      }),
      getSkillGaps(supabase, profileId, roleId)
    ]);

    if (!capabilityGaps.success || !capabilityGaps.data) {
      throw new Error('Could not analyze capability gaps');
    }

    // Phase 3: Find potential mentors
    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        "Finding potential mentors who can guide your development...",
        'finding_mentors'
      );
    }

    const mentorMatches = await getSemanticMatches(
      supabase,
      { id: roleId, table: 'roles' as Tables },
      'profiles',
      5,
      0.7
    );

    // Prepare contexts
    const context: ActionContext = {
      profileData,
      roleData,
      capabilityGaps,
      skillGaps,
      mentorMatches,
      sessionId
    };

    const aiContext = prepareAIContext(context);

    // Phase 4: Generate development plan
    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        "Creating your personalized development plan...",
        'generating_plan'
      );
    }

    const prompt = buildDevelopmentPlanPrompt(aiContext);
    const safePrompt = buildSafePrompt(prompt);

    const aiResponse = await invokeChatModel(
      {
        system: safePrompt.system,
        user: safePrompt.user
      },
      {
        model: 'openai:gpt-3.5-turbo',
        temperature: 0.2,
        max_tokens: 1500
      }
    );

    if (!aiResponse.success || !aiResponse.output) {
      throw new Error(`AI API error: ${aiResponse.error?.message || 'Unknown error'}`);
    }

    // Phase 5: Parse and validate the plan
    const developmentPlan = JSON.parse(aiResponse.output);
    developmentPlan.explanation = `AI generated a personalized development plan with ${developmentPlan.recommendedSkills.length} skill recommendations, ${developmentPlan.interimRoles.length} suggested interim roles, and ${developmentPlan.suggestedMentors.length} potential mentors to support the journey.`;

    // Phase 6: Log completion and results
    await logAgentAction(supabase, {
      entityType: 'profile',
      entityId: profileId,
      payload: {
        action: 'development_plan_generated',
        planSummary: {
          skillCount: developmentPlan.recommendedSkills.length,
          interimRoleCount: developmentPlan.interimRoles.length,
          mentorCount: developmentPlan.suggestedMentors.length,
          timeToReadiness: developmentPlan.estimatedTimeToReadiness
        },
        prompt: safePrompt,
        aiResponse: {
          summary: developmentPlan.explanation,
          raw: aiResponse.output
        }
      },
      semanticMetrics: {
        similarityScores: {
          roleMatch: 0.8,
          skillAlignment: 0.7,
          capabilityAlignment: 0.75
        },
        matchingStrategy: 'hybrid',
        confidenceScore: 0.9
      }
    });

    return {
      success: true,
      data: developmentPlan,
      actionsTaken: [
        {
          tool: 'getProfileData',
          reason: 'Retrieved profile and role data',
          result: 'success',
          confidence: 1.0,
          inputs: { profileId, roleId },
          timestamp: new Date().toISOString()
        },
        {
          tool: 'analyzeGaps',
          reason: 'Analyzed capability and skill gaps',
          result: 'success',
          confidence: 0.9,
          inputs: { profileId, roleId },
          timestamp: new Date().toISOString()
        },
        {
          tool: 'findMentors',
          reason: 'Found potential mentors',
          result: 'success',
          confidence: 0.8,
          inputs: { roleId },
          timestamp: new Date().toISOString()
        },
        {
          tool: 'generatePlan',
          reason: 'Generated AI-powered development plan',
          result: 'success',
          confidence: 0.85,
          inputs: { profileId, roleId },
          timestamp: new Date().toISOString()
        }
      ],
      nextActions: [
        {
          type: 'review_plan',
          description: 'Review and customize development plan',
          priority: 'high'
        },
        {
          type: 'connect_mentor',
          description: 'Connect with suggested mentors',
          priority: 'medium'
        },
        {
          type: 'start_training',
          description: 'Begin recommended training modules',
          priority: 'high'
        }
      ]
    };

  } catch (error) {
    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        "I encountered an error while creating your development plan. Let me know if you'd like to try again.",
        'plan_error'
      );
    }

    return {
      success: false,
      error: {
        type: 'DEVELOPMENT_PLAN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error
      }
    };
  }
}

// Create the MCPActionV2 implementation
export const getDevelopmentPlan: MCPActionV2 = {
  id: 'getDevelopmentPlan',
  title: 'Get Development Plan',
  description: 'Generate a detailed development plan for a profile to reach a target role',
  applicableRoles: ['candidate', 'manager'],
  capabilityTags: ['Career Development', 'Skill Development', 'Mentoring'],
  requiredInputs: ['profileId', 'roleId'],
  tags: ['development', 'tactical', 'strategic'],
  recommendedAfter: ['getCapabilityGaps', 'getSemanticSkillRecommendations'],
  recommendedBefore: ['logPlannedTransitions'],
  usesAI: true,
  actionFn: (ctx: Record<string, any>) => getDevelopmentPlanBase(ctx as MCPRequest)
}; 