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
import { logAgentProgress } from '../../../chatUtils.ts';
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

    // Load profile and role data
    const [profileData, roleData] = await Promise.all([
      getProfileData(supabase, profileId),
      getRoleDetail(supabase, roleId)
    ]);

    if (!profileData || !roleData) {
      throw new Error('Could not fetch profile or role data');
    }

    // Analyze gaps
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

    // Generate development plan
    const developmentPlan = {
      recommendedSkills: [],
      recommendedCapabilities: [],
      estimatedTimeToReadiness: '3-6 months',
      suggestedMentors: [],
      trainingResources: []
    };

    // Only log if we have recommendations
    if (sessionId && (developmentPlan.recommendedSkills.length > 0 || developmentPlan.recommendedCapabilities.length > 0)) {
      const planMarkdown = `### 📚 Development Plan

${developmentPlan.recommendedCapabilities.length > 0 ? `#### Key Capabilities to Develop
${developmentPlan.recommendedCapabilities.map(cap => `- **${cap.name}**: ${cap.description}`).join('\n')}` : ''}

${developmentPlan.recommendedSkills.length > 0 ? `#### Skills to Acquire
${developmentPlan.recommendedSkills.map(skill => `- **${skill.name}**: ${skill.description}`).join('\n')}` : ''}

Estimated Time to Role Readiness: ${developmentPlan.estimatedTimeToReadiness}

${developmentPlan.suggestedMentors.length > 0 ? `#### Suggested Mentors
${developmentPlan.suggestedMentors.map(mentor => `- ${mentor.name} (${mentor.role})`).join('\n')}` : ''}`;

      await logAgentProgress(
        supabase,
        sessionId,
        planMarkdown,
        { phase: 'plan_generated' }
      );
    }

    return {
      success: true,
      data: developmentPlan,
      dataForDownstreamPrompt: {
        getDevelopmentPlan: {
          dataSummary: planMarkdown,
          structured: {
            recommendedSkillsCount: developmentPlan.recommendedSkills.length,
            recommendedCapabilitiesCount: developmentPlan.recommendedCapabilities.length,
            estimatedTimeToReadiness: developmentPlan.estimatedTimeToReadiness,
            mentorCount: developmentPlan.suggestedMentors.length,
            topSkills: developmentPlan.recommendedSkills.slice(0, 3).map(s => s.name),
            topCapabilities: developmentPlan.recommendedCapabilities.slice(0, 3).map(c => c.name)
          },
          truncated: false
        }
      },
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
        }
      ]
    };

  } catch (error) {
    console.error('Error in getDevelopmentPlan:', error);
    
    if (sessionId) {
      await logAgentProgress(
        supabase,
        sessionId,
        "I encountered an error while creating your development plan. Let me know if you'd like to try again.",
        { phase: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }

    return {
      success: false,
      error: {
        type: 'PLANNING_ERROR',
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