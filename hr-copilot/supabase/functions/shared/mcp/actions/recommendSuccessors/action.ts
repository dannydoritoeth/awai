/**
 * @fileoverview Recommends potential successors for a role based on capability alignment
 * 
 * Related Actions:
 * - getReadinessAssessment: Used to evaluate readiness for the target role
 * - getCapabilityGaps: Used to analyze capability alignment
 * - getDevelopmentPlan: Used to plan succession transitions
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../../database.types.ts';
import { MCPActionV2, MCPRequest, MCPResponse } from '../../types/action.ts';
import { getProfileData, ProfileData } from '../../../profile/getProfileData.ts';
import { getRoleDetail, RoleDetail } from '../../../role/getRoleDetail.ts';
import { logAgentProgress } from '../../../chatUtils.ts';
import { getSemanticMatches } from '../../../embeddings.ts';

interface SuccessorRecommendation {
  profileId: string;
  name: string;
  readinessScore: number;
  capabilityMatch: {
    matchingCapabilities: string[];
    developingCapabilities: string[];
    gapCapabilities: string[];
    overallMatch: number;
  };
  timeToReadiness: {
    estimate: string;
    criticalGaps: string[];
    developmentNeeds: string[];
  };
  summary: string;
}

async function recommendSuccessorsBase(request: MCPRequest): Promise<MCPResponse<SuccessorRecommendation[]>> {
  const supabase = request.supabase as SupabaseClient<Database>;
  const { roleId, sessionId } = request;

  if (!roleId) {
    return {
      success: false,
      error: {
        type: 'INVALID_INPUT',
        message: 'roleId is required',
        details: null
      }
    };
  }

  try {
    // Get role details
    const roleDetailResponse = await getRoleDetail(supabase, roleId);
    if (!roleDetailResponse.data) {
      return {
        success: false,
        error: {
          type: 'DATA_NOT_FOUND',
          message: 'Role data not found',
          details: null
        }
      };
    }
    const roleDetail = roleDetailResponse.data;

    // Get semantic matches based on role capabilities
    const semanticMatches = await getSemanticMatches(
      supabase,
      { id: roleId, table: 'roles' },
      'profiles',
      10,
      0.5
    );

    // Get detailed profile data for matches
    const profileIds = semanticMatches.map(m => m.id);
    const profileDataPromises = profileIds.map(id => getProfileData(supabase, id));
    const profilesData = await Promise.all(profileDataPromises);

    // Analyze each profile for succession readiness
    const recommendations: SuccessorRecommendation[] = [];

    for (let i = 0; i < semanticMatches.length; i++) {
      const match = semanticMatches[i];
      const profileData = profilesData[i];
      if (!profileData) continue;

      // Analyze capability matches
      const matchingCapabilities = roleDetail.capabilities
        .filter(rc => profileData.capabilities.some(pc => 
          pc.name.toLowerCase() === rc.name.toLowerCase() && 
          pc.level >= (rc.level ? parseInt(rc.level) : 0)
        ))
        .map(c => c.name);

      const developingCapabilities = roleDetail.capabilities
        .filter(rc => profileData.capabilities.some(pc => 
          pc.name.toLowerCase() === rc.name.toLowerCase() && 
          pc.level < (rc.level ? parseInt(rc.level) : 0)
        ))
        .map(c => c.name);

      const gapCapabilities = roleDetail.capabilities
        .filter(rc => !profileData.capabilities.some(pc => 
          pc.name.toLowerCase() === rc.name.toLowerCase()
        ))
        .map(c => c.name);

      const capabilityMatchScore = roleDetail.capabilities.length > 0 
        ? (matchingCapabilities.length + 0.5 * developingCapabilities.length) / roleDetail.capabilities.length
        : 0;

      // Calculate readiness score (weighted average of semantic and capability matches)
      const readinessScore = (
        match.similarity * 0.4 + 
        capabilityMatchScore * 0.6
      ) * 100;

      // Estimate time to readiness
      let timeEstimate: string;
      if (readinessScore >= 90) {
        timeEstimate = 'Immediate';
      } else if (readinessScore >= 75) {
        timeEstimate = '3-6 months';
      } else if (readinessScore >= 60) {
        timeEstimate = '6-12 months';
      } else if (readinessScore >= 40) {
        timeEstimate = '12-18 months';
      } else {
        timeEstimate = '18+ months';
      }

      // Identify critical gaps and development needs
      const criticalGaps = gapCapabilities.filter(c => 
        roleDetail.capabilities.find(rc => 
          rc.name === c && rc.capabilityType === 'critical'
        )
      );

      const developmentNeeds = [
        ...gapCapabilities.map(c => `Acquire ${c}`),
        ...developingCapabilities.map(c => `Strengthen ${c}`)
      ];

      // Generate recommendation summary
      const summary = `${match.name} (${readinessScore.toFixed(1)}% ready)
• Capability alignment: ${(capabilityMatchScore * 100).toFixed(1)}%
  - ${matchingCapabilities.length} matching capabilities
  - ${developingCapabilities.length} developing capabilities
  - ${gapCapabilities.length} capability gaps
• Time to readiness: ${timeEstimate}
  - ${criticalGaps.length} critical gaps
  - ${developmentNeeds.length} development needs`;

      recommendations.push({
        profileId: match.id,
        name: match.name,
        readinessScore,
        capabilityMatch: {
          matchingCapabilities,
          developingCapabilities,
          gapCapabilities,
          overallMatch: capabilityMatchScore * 100
        },
        timeToReadiness: {
          estimate: timeEstimate,
          criticalGaps,
          developmentNeeds
        },
        summary
      });
    }

    // Sort recommendations by readiness score
    recommendations.sort((a, b) => b.readinessScore - a.readinessScore);

    // Log progress if session exists
    if (sessionId) {
      const summaryText = recommendations
        .map((r, i) => `${i + 1}. ${r.summary}`)
        .join('\n\n');

      await logAgentProgress(
        supabase,
        sessionId,
        `### 👥 Succession Recommendations\n\n${summaryText}`,
        { phase: 'successors_recommended' }
      );
    }

    return {
      success: true,
      data: recommendations,
      dataForDownstreamPrompt: {
        recommendSuccessors: {
          dataSummary: `Found ${recommendations.length} potential successors for ${roleDetail.title}.`,
          structured: recommendations.map(r => ({
            name: r.name,
            readinessScore: r.readinessScore,
            capabilityMatch: r.capabilityMatch.overallMatch,
            timeToReadiness: r.timeToReadiness.estimate
          })),
          truncated: false
        }
      },
      actionsTaken: [
        {
          tool: 'getRoleDetail',
          reason: 'Retrieved role details',
          result: 'success',
          confidence: 1.0,
          inputs: { roleId },
          timestamp: new Date().toISOString()
        },
        {
          tool: 'getSemanticMatches',
          reason: 'Found semantically matching profiles',
          result: 'success',
          confidence: 0.8,
          inputs: { roleId },
          timestamp: new Date().toISOString()
        },
        {
          tool: 'getProfileData',
          reason: 'Retrieved detailed profile data',
          result: 'success',
          confidence: 1.0,
          inputs: { profileIds },
          timestamp: new Date().toISOString()
        },
        {
          tool: 'analyzeSuccession',
          reason: 'Analyzed succession readiness',
          result: 'success',
          confidence: 0.9,
          inputs: { roleId },
          timestamp: new Date().toISOString()
        }
      ]
    };

  } catch (error) {
    console.error('Error in recommendSuccessors:', error);
    
    if (sessionId) {
      await logAgentProgress(
        supabase,
        sessionId,
        "I encountered an error while finding potential successors. Let me know if you'd like to try again.",
        { phase: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }

    return {
      success: false,
      error: {
        type: 'RECOMMENDATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error
      }
    };
  }
}

// Create the MCPActionV2 implementation
export const recommendSuccessors: MCPActionV2 = {
  id: 'recommendSuccessors',
  title: 'Recommend Successors',
  description: 'Identify potential successors for a role based on capability alignment',
  applicableRoles: ['manager', 'hr'],
  capabilityTags: ['Succession Planning', 'Role Analysis', 'Talent Development'],
  requiredInputs: ['roleId'],
  tags: ['succession', 'recommendations', 'strategic'],
  suggestedPrerequisites: ['getRoleDetails', 'getReadinessAssessment'],
  suggestedPostrequisites: ['getDevelopmentPlan'],
  usesAI: false,
  actionFn: (ctx: Record<string, any>) => recommendSuccessorsBase(ctx as MCPRequest),
  getDefaultArgs: (context: Record<string, any>) => ({
    roleId: context.roleId
  })
}; 