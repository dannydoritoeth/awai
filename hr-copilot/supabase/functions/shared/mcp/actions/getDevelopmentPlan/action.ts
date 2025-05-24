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
import { getRoleDetail, RoleDetail } from '../../../role/getRoleDetail.ts';
import { invokeChatModelV2 } from '../../../ai/invokeAIModelV2.ts';
import { getSemanticMatches } from '../../../embeddings.ts';
import type { Tables } from '../../../embeddings.ts';
import { MCPActionV2, MCPRequest, MCPResponse } from '../../types/action.ts';
import { logAgentProgress } from '../../../chatUtils.ts';
import { buildDevelopmentPlanPrompt, AIContext } from './buildPrompt.ts';

// Types for internal context vs AI context separation
interface ActionContext {
  profileData: any;
  roleData: RoleDetail & {
    requirements?: string[];
  };
  capabilityGaps: any;
  skillGaps: any;
  mentorMatches: any[];
  sessionId?: string;
  downstreamData?: any;
}

interface DevelopmentPlan {
  recommendedSkills: Array<{
    name: string;
    priority: 'high' | 'medium' | 'low';
    currentLevel?: number;
    targetLevel: number;
    timeEstimate: string;
    trainingModules: Array<{
      name: string;
      duration: string;
    }>;
  }>;
  interimRoles: Array<{
    title: string;
    typicalDuration: string;
    relevance: string;
    keySkillsGained: string[];
  }>;
  suggestedMentors: Array<{
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
  // Get downstream data from previous actions if available
  const downstreamData = context.downstreamData || {};
  const capabilityGapsData = downstreamData.getCapabilityGaps;
  const skillRecommendationsData = downstreamData.getSemanticSkillRecommendations;

  // Ensure we have valid gaps data
  const capabilityGaps = capabilityGapsData?.structured?.gaps || 
    (context.capabilityGaps.data?.gaps || context.capabilityGaps.data || []);
  const skillGaps = context.skillGaps.data || [];

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
      title: context.roleData.title || 'Target Role',
      requirements: context.roleData.requirements || []
    },
    gaps: {
      capabilities: capabilityGaps,
      skills: skillGaps
    },
    potentialMentors: context.mentorMatches.map(match => ({
      id: match.id,
      name: match.name || '',
      title: match.metadata?.title,
      expertise: match.metadata?.expertise,
      similarity: match.similarity
    })),
    previousAnalysis: {
      capabilityReadiness: capabilityGapsData?.structured?.overallReadiness,
      criticalCapabilityGaps: capabilityGapsData?.structured?.criticalGaps,
      recommendedSkills: skillRecommendationsData?.structured?.topRecommendations || [],
      skillPriorities: {
        high: skillRecommendationsData?.structured?.highPriorityCount || 0,
        medium: skillRecommendationsData?.structured?.mediumPriorityCount || 0,
        low: skillRecommendationsData?.structured?.lowPriorityCount || 0
      }
    }
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
    const [profileData, roleDetailResponse] = await Promise.all([
      getProfileData(supabase, profileId),
      getRoleDetail(supabase, roleId)
    ]);

    if (!profileData || !roleDetailResponse.data) {
      throw new Error('Could not fetch profile or role data');
    }

    const roleData = roleDetailResponse.data;

    // Check for existing analysis in context
    const downstreamData = request.context?.downstreamData || {};
    const hasExistingAnalysis = downstreamData.getCapabilityGaps || downstreamData.getSemanticSkillRecommendations;

    // Only run gap analysis if we don't have it from context
    const [capabilityGaps, skillGaps] = !hasExistingAnalysis ? await Promise.all([
      getCapabilityGaps.actionFn({
        supabase,
        profileId,
        roleId,
        mode: 'candidate',
        context: {}
      }),
      getSkillGaps(supabase, profileId, roleId)
    ]) : [
      downstreamData.getCapabilityGaps,
      downstreamData.getSkillGaps
    ];

    if (!capabilityGaps.success || !capabilityGaps.data) {
      throw new Error('Could not analyze capability gaps');
    }

    // Find potential mentors
    const mentorMatches = await getSemanticMatches(
      supabase,
      { id: roleId, table: 'roles' as Tables },
      'profiles' as Tables,
      20, // Limit to 20 potential mentors
      0.6 // Similarity threshold
    );

    // Prepare context for AI processing
    const context: ActionContext = {
      profileData,
      roleData: {
        ...roleData,
        requirements: roleData.capabilities.map(cap => 
          `${cap.name} (Level ${cap.level || 'Required'})${cap.capabilityType ? ` [${cap.capabilityType}]` : ''}`
        )
      },
      capabilityGaps,
      skillGaps,
      mentorMatches,
      sessionId,
      downstreamData
    };

    // Build AI prompt
    const aiContext = prepareAIContext(context);
    const prompt = buildDevelopmentPlanPrompt(aiContext);

    // Generate development plan
    const aiResponse = await invokeChatModelV2(prompt, {
      model: 'openai:gpt-4',
      temperature: 0.2,
      max_tokens: 2000,
      supabase,
      sessionId: sessionId || 'default',
      actionType: 'getDevelopmentPlan'
    });

    if (!aiResponse.success || !aiResponse.output) {
      throw new Error(`AI processing failed: ${aiResponse.error?.message || 'Unknown error'}`);
    }

    // Parse AI response
    const developmentPlan = JSON.parse(aiResponse.output) as DevelopmentPlan;

    // Log progress if we have a session
    let planMarkdown = '';
    if (sessionId) {
      planMarkdown = `### 📚 Development Plan

#### Key Skills to Develop
${developmentPlan.recommendedSkills.map(skill => `- **${skill.name}** (Priority: ${skill.priority})
  - Current Level: ${skill.currentLevel || 'N/A'} → Target Level: ${skill.targetLevel}
  - Time Estimate: ${skill.timeEstimate}
  - Training: ${skill.trainingModules.map(m => `${m.name} (${m.duration})`).join(', ')}`).join('\n')}

#### Interim Roles
${developmentPlan.interimRoles.map(role => `- **${role.title}** (${role.typicalDuration})
  - Relevance: ${role.relevance}
  - Key Skills: ${role.keySkillsGained.join(', ')}`).join('\n')}

#### Suggested Mentors
${developmentPlan.suggestedMentors.map(mentor => `- **${mentor.name}** (${mentor.title})
  - Expertise: ${mentor.expertise.join(', ')}
  - Match Score: ${(mentor.matchScore * 100).toFixed(1)}%`).join('\n')}

#### Timeline
- Short Term: ${developmentPlan.timeline.shortTerm.join(', ')}
- Medium Term: ${developmentPlan.timeline.mediumTerm.join(', ')}
- Long Term: ${developmentPlan.timeline.longTerm.join(', ')}

Estimated Time to Role Readiness: ${developmentPlan.estimatedTimeToReadiness}

${developmentPlan.explanation}`;

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
            recommendedCapabilitiesCount: developmentPlan.recommendedSkills.filter(s => s.priority === 'high').length,
            estimatedTimeToReadiness: developmentPlan.estimatedTimeToReadiness,
            mentorCount: developmentPlan.suggestedMentors.length,
            topSkills: developmentPlan.recommendedSkills.slice(0, 3).map(s => s.name),
            topPriorities: developmentPlan.timeline.shortTerm.slice(0, 3)
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
        },
        {
          tool: 'findMentors',
          reason: 'Found potential mentors',
          result: 'success',
          confidence: 0.8,
          inputs: { roleTitle: context.roleData.title },
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
      
      // Mark the error as logged
      if (error instanceof Error) {
        (error as any).wasLogged = true;
      }
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
  suggestedPrerequisites: ['getCapabilityGaps', 'getSemanticSkillRecommendations'],
  suggestedPostrequisites: ['logPlannedTransitions'],
  usesAI: true,
  actionFn: (ctx: Record<string, any>) => getDevelopmentPlanBase(ctx as MCPRequest)
}; 