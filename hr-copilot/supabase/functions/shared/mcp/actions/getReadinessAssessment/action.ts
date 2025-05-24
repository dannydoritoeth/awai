/**
 * @fileoverview Evaluates profile readiness for a target role with weighted scoring
 * 
 * Related Actions:
 * - getCapabilityGaps: Used to analyze capability alignment
 * - getSkillGaps: Used to analyze skill alignment
 * - getDevelopmentPlan: Uses readiness assessment for planning
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../../database.types.ts';
import { MCPActionV2, MCPRequest, MCPResponse } from '../../types/action.ts';
import { getProfileData, ProfileData } from '../../../profile/getProfileData.ts';
import { getRolesData, RoleData } from '../../../role/getRoleData.ts';
import { logAgentProgress } from '../../../chatUtils.ts';
import { getLevelValue } from '../../../utils.ts';

interface ReadinessAssessment {
  score: number;
  capabilityScore: number;
  skillScore: number;
  criticalGaps: Array<{
    type: 'capability' | 'skill';
    name: string;
    currentLevel: string;
    requiredLevel: string;
    severity: number;
  }>;
  developmentTimeline: {
    shortTerm: string[];
    mediumTerm: string[];
    longTerm: string[];
  };
  summary: string;
}

async function getReadinessAssessmentBase(request: MCPRequest): Promise<MCPResponse<ReadinessAssessment>> {
  const supabase = request.supabase as SupabaseClient<Database>;
  const { profileId, roleId, sessionId } = request;

  if (!profileId || !roleId) {
    return {
      success: false,
      error: {
        type: 'INVALID_INPUT',
        message: 'Both profileId and roleId are required',
        details: null
      }
    };
  }

  try {
    // Get profile and role data
    const [profileData, rolesData] = await Promise.all([
      getProfileData(supabase, profileId),
      getRolesData(supabase, [roleId])
    ]);

    const roleData = rolesData[roleId];

    if (!profileData || !roleData) {
      return {
        success: false,
        error: {
          type: 'DATA_NOT_FOUND',
          message: 'Profile or role data not found',
          details: null
        }
      };
    }

    // Calculate capability scores with 60% weight
    const capabilityMatches = roleData.capabilities.map(required => {
      const actual = profileData.capabilities.find(c => 
        c.id === required.id || 
        c.name.toLowerCase() === required.name.toLowerCase()
      );

      return {
        name: required.name,
        required: required.required_level,
        actual: actual?.level || 0,
        match: actual ? Math.min(actual.level / required.required_level, 1) : 0,
        severity: actual ? 
          actual.level >= required.required_level ? 0 :
          ((required.required_level - actual.level) / required.required_level) * 100 : 100
      };
    });

    // Calculate skill scores with 40% weight
    const skillMatches = roleData.skills.map(required => {
      const actual = profileData.skills.find(s => 
        s.id === required.id || 
        s.name.toLowerCase() === required.name.toLowerCase()
      );

      return {
        name: required.name,
        required: required.required_level,
        actual: actual?.level || 0,
        match: actual ? Math.min(actual.level / required.required_level, 1) : 0,
        severity: actual ? 
          actual.level >= required.required_level ? 0 :
          ((required.required_level - actual.level) / required.required_level) * 100 : 100
      };
    });

    // Calculate weighted scores
    const capabilityScore = capabilityMatches.length > 0 
      ? capabilityMatches.reduce((sum, m) => sum + m.match, 0) / capabilityMatches.length * 100
      : 0;
    
    const skillScore = skillMatches.length > 0
      ? skillMatches.reduce((sum, m) => sum + m.match, 0) / skillMatches.length * 100
      : 0;

    // Overall score with 60/40 weighting
    const overallScore = (capabilityScore * 0.6) + (skillScore * 0.4);

    // Identify critical gaps (severity > 70)
    const criticalGaps = [
      ...capabilityMatches
        .filter(m => m.severity > 70)
        .map(m => ({
          type: 'capability' as const,
          name: m.name,
          currentLevel: String(m.actual),
          requiredLevel: String(m.required),
          severity: m.severity
        })),
      ...skillMatches
        .filter(m => m.severity > 70)
        .map(m => ({
          type: 'skill' as const,
          name: m.name,
          currentLevel: String(m.actual),
          requiredLevel: String(m.required),
          severity: m.severity
        }))
    ].sort((a, b) => b.severity - a.severity);

    // Generate development timeline
    const developmentTimeline = {
      shortTerm: criticalGaps
        .filter(g => g.severity <= 50)
        .map(g => g.name),
      mediumTerm: criticalGaps
        .filter(g => g.severity > 50 && g.severity <= 70)
        .map(g => g.name),
      longTerm: criticalGaps
        .filter(g => g.severity > 70)
        .map(g => g.name)
    };

    // Generate summary
    const readinessLevel = overallScore >= 90 ? 'Fully ready' :
                          overallScore >= 75 ? 'Well prepared' :
                          overallScore >= 60 ? 'Mostly prepared' :
                          overallScore >= 40 ? 'Partially prepared' :
                          'Additional preparation needed';

    const summary = `${readinessLevel} for ${roleData.title} (${overallScore.toFixed(1)}% overall readiness)
• Capability alignment: ${capabilityScore.toFixed(1)}%
• Skill alignment: ${skillScore.toFixed(1)}%
• Critical gaps: ${criticalGaps.length}
• Development timeline: ${developmentTimeline.shortTerm.length} short-term, ${developmentTimeline.mediumTerm.length} medium-term, ${developmentTimeline.longTerm.length} long-term items`;

    const assessment: ReadinessAssessment = {
      score: overallScore,
      capabilityScore,
      skillScore,
      criticalGaps,
      developmentTimeline,
      summary
    };

    // Log progress if session exists
    if (sessionId) {
      await logAgentProgress(
        supabase,
        sessionId,
        `### 📊 Readiness Assessment\n\n${summary}`,
        { phase: 'readiness_assessed' }
      );
    }

    return {
      success: true,
      data: assessment,
      dataForDownstreamPrompt: {
        getReadinessAssessment: {
          dataSummary: summary,
          structured: {
            overallScore,
            capabilityScore,
            skillScore,
            criticalGapsCount: criticalGaps.length,
            shortTermItems: developmentTimeline.shortTerm.length,
            mediumTermItems: developmentTimeline.mediumTerm.length,
            longTermItems: developmentTimeline.longTerm.length
          },
          truncated: false
        }
      },
      actionsTaken: [
        {
          tool: 'getProfileData',
          reason: 'Retrieved profile data',
          result: 'success',
          confidence: 1.0,
          inputs: { profileId },
          timestamp: new Date().toISOString()
        },
        {
          tool: 'getRolesData',
          reason: 'Retrieved role data',
          result: 'success',
          confidence: 1.0,
          inputs: { roleId },
          timestamp: new Date().toISOString()
        },
        {
          tool: 'calculateReadiness',
          reason: 'Calculated readiness scores',
          result: 'success',
          confidence: 0.9,
          inputs: { profileId, roleId },
          timestamp: new Date().toISOString()
        }
      ]
    };

  } catch (error) {
    console.error('Error in getReadinessAssessment:', error);
    
    if (sessionId) {
      await logAgentProgress(
        supabase,
        sessionId,
        "I encountered an error while assessing readiness. Let me know if you'd like to try again.",
        { phase: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }

    return {
      success: false,
      error: {
        type: 'ASSESSMENT_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error
      }
    };
  }
}

// Create the MCPActionV2 implementation
export const getReadinessAssessment: MCPActionV2 = {
  id: 'getReadinessAssessment',
  title: 'Get Readiness Assessment',
  description: 'Evaluate profile readiness for a target role with weighted scoring',
  applicableRoles: ['candidate', 'manager', 'hr'],
  capabilityTags: ['Career Development', 'Role Analysis', 'Gap Analysis'],
  requiredInputs: ['profileId', 'roleId'],
  tags: ['readiness', 'assessment', 'tactical'],
  suggestedPrerequisites: ['getProfileContext', 'getRoleDetails'],
  suggestedPostrequisites: ['getCapabilityGaps', 'getDevelopmentPlan'],
  usesAI: false,
  actionFn: (ctx: Record<string, any>) => getReadinessAssessmentBase(ctx as MCPRequest),
  getDefaultArgs: (context: Record<string, any>) => ({
    profileId: context.profileId,
    roleId: context.roleId
  })
};

export default getReadinessAssessment; 