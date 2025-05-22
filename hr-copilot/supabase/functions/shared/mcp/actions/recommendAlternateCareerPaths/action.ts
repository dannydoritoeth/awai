/**
 * @fileoverview Recommends alternative career paths based on transferable capabilities
 * 
 * Related Actions:
 * - getReadinessAssessment: Used to evaluate readiness for recommended roles
 * - getCapabilityGaps: Used to analyze capability alignment
 * - getDevelopmentPlan: Used to plan transitions to recommended roles
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../../database.types.ts';
import { MCPActionV2, MCPRequest, MCPResponse } from '../../types/action.ts';
import { getProfileData, ProfileData } from '../../../profile/getProfileData.ts';
import { getRolesData, RoleData } from '../../../role/getRoleData.ts';
import { logAgentProgress } from '../../../chatUtils.ts';
import { getSemanticMatches } from '../../../embeddings.ts';

interface CareerPathRecommendation {
  roleId: string;
  title: string;
  matchScore: number;
  capabilityMatch: {
    matchingCapabilities: string[];
    transferableCapabilities: string[];
    gapCapabilities: string[];
    overallMatch: number;
  };
  skillMatch: {
    matchingSkills: string[];
    transferableSkills: string[];
    gapSkills: string[];
    overallMatch: number;
  };
  summary: string;
}

async function recommendAlternateCareerPathsBase(request: MCPRequest): Promise<MCPResponse<CareerPathRecommendation[]>> {
  const supabase = request.supabase as SupabaseClient<Database>;
  const { profileId, sessionId } = request;

  if (!profileId) {
    return {
      success: false,
      error: {
        type: 'INVALID_INPUT',
        message: 'profileId is required',
        details: null
      }
    };
  }

  try {
    // Get profile data
    const profileData = await getProfileData(supabase, profileId);
    if (!profileData) {
      return {
        success: false,
        error: {
          type: 'DATA_NOT_FOUND',
          message: 'Profile data not found',
          details: null
        }
      };
    }

    // Get semantic matches based on profile capabilities and skills
    const semanticMatches = await getSemanticMatches(
      supabase,
      { id: profileId, table: 'profiles' },
      'roles',
      10,
      0.5
    );

    // Get detailed role data for matches
    const roleIds = semanticMatches.map(m => m.id);
    const rolesData = await getRolesData(supabase, roleIds);

    // Analyze each role for capability and skill matches
    const recommendations: CareerPathRecommendation[] = [];

    for (const match of semanticMatches) {
      const roleData = rolesData[match.id];
      if (!roleData) continue;

      // Analyze capability matches
      const matchingCapabilities = roleData.capabilities
        .filter(rc => profileData.capabilities.some(pc => 
          pc.name.toLowerCase() === rc.name.toLowerCase() && 
          pc.level >= rc.required_level
        ))
        .map(c => c.name);

      const transferableCapabilities = roleData.capabilities
        .filter(rc => profileData.capabilities.some(pc => 
          pc.name.toLowerCase() === rc.name.toLowerCase() && 
          pc.level < rc.required_level
        ))
        .map(c => c.name);

      const gapCapabilities = roleData.capabilities
        .filter(rc => !profileData.capabilities.some(pc => 
          pc.name.toLowerCase() === rc.name.toLowerCase()
        ))
        .map(c => c.name);

      const capabilityMatchScore = roleData.capabilities.length > 0 
        ? (matchingCapabilities.length + 0.5 * transferableCapabilities.length) / roleData.capabilities.length
        : 0;

      // Analyze skill matches
      const matchingSkills = roleData.skills
        .filter(rs => profileData.skills.some(ps => 
          ps.name.toLowerCase() === rs.name.toLowerCase() && 
          ps.level >= rs.required_level
        ))
        .map(s => s.name);

      const transferableSkills = roleData.skills
        .filter(rs => profileData.skills.some(ps => 
          ps.name.toLowerCase() === rs.name.toLowerCase() && 
          ps.level < rs.required_level
        ))
        .map(s => s.name);

      const gapSkills = roleData.skills
        .filter(rs => !profileData.skills.some(ps => 
          ps.name.toLowerCase() === rs.name.toLowerCase()
        ))
        .map(s => s.name);

      const skillMatchScore = roleData.skills.length > 0
        ? (matchingSkills.length + 0.5 * transferableSkills.length) / roleData.skills.length
        : 0;

      // Calculate overall match score (weighted average of semantic, capability, and skill matches)
      const overallScore = (
        match.similarity * 0.4 + 
        capabilityMatchScore * 0.4 + 
        skillMatchScore * 0.2
      ) * 100;

      // Generate recommendation summary
      const summary = `${roleData.title} (${overallScore.toFixed(1)}% match)
• Capability alignment: ${(capabilityMatchScore * 100).toFixed(1)}%
  - ${matchingCapabilities.length} matching capabilities
  - ${transferableCapabilities.length} transferable capabilities
  - ${gapCapabilities.length} capability gaps
• Skill alignment: ${(skillMatchScore * 100).toFixed(1)}%
  - ${matchingSkills.length} matching skills
  - ${transferableSkills.length} transferable skills
  - ${gapSkills.length} skill gaps`;

      recommendations.push({
        roleId: match.id,
        title: roleData.title,
        matchScore: overallScore,
        capabilityMatch: {
          matchingCapabilities,
          transferableCapabilities,
          gapCapabilities,
          overallMatch: capabilityMatchScore * 100
        },
        skillMatch: {
          matchingSkills,
          transferableSkills,
          gapSkills,
          overallMatch: skillMatchScore * 100
        },
        summary
      });
    }

    // Sort recommendations by match score
    recommendations.sort((a, b) => b.matchScore - a.matchScore);

    // Log progress if session exists
    if (sessionId) {
      const summaryText = recommendations
        .map((r, i) => `${i + 1}. ${r.summary}`)
        .join('\n\n');

      await logAgentProgress(
        supabase,
        sessionId,
        `### 🎯 Alternative Career Paths\n\n${summaryText}`,
        { phase: 'career_paths_recommended' }
      );
    }

    return {
      success: true,
      data: recommendations,
      dataForDownstreamPrompt: {
        recommendAlternateCareerPaths: {
          dataSummary: `Found ${recommendations.length} potential career paths based on capability and skill alignment.`,
          structured: recommendations.map(r => ({
            title: r.title,
            matchScore: r.matchScore,
            capabilityMatch: r.capabilityMatch.overallMatch,
            skillMatch: r.skillMatch.overallMatch
          })),
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
          tool: 'getSemanticMatches',
          reason: 'Found semantically matching roles',
          result: 'success',
          confidence: 0.8,
          inputs: { profileId },
          timestamp: new Date().toISOString()
        },
        {
          tool: 'getRolesData',
          reason: 'Retrieved detailed role data',
          result: 'success',
          confidence: 1.0,
          inputs: { roleIds },
          timestamp: new Date().toISOString()
        },
        {
          tool: 'analyzeCareerPaths',
          reason: 'Analyzed capability and skill alignment',
          result: 'success',
          confidence: 0.9,
          inputs: { profileId },
          timestamp: new Date().toISOString()
        }
      ]
    };

  } catch (error) {
    console.error('Error in recommendAlternateCareerPaths:', error);
    
    if (sessionId) {
      await logAgentProgress(
        supabase,
        sessionId,
        "I encountered an error while finding alternative career paths. Let me know if you'd like to try again.",
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
export const recommendAlternateCareerPaths: MCPActionV2 = {
  id: 'recommendAlternateCareerPaths',
  title: 'Recommend Alternative Career Paths',
  description: 'Explore alternative roles based on transferable capabilities and skills',
  applicableRoles: ['candidate', 'manager', 'hr'],
  capabilityTags: ['Career Development', 'Role Analysis', 'Succession Planning'],
  requiredInputs: ['profileId'],
  tags: ['career_paths', 'recommendations', 'strategic'],
  recommendedAfter: ['getProfileContext', 'getReadinessAssessment'],
  recommendedBefore: ['getDevelopmentPlan'],
  usesAI: false,
  actionFn: (ctx: Record<string, any>) => recommendAlternateCareerPathsBase(ctx as MCPRequest),
  getDefaultArgs: (context: Record<string, any>) => ({
    profileId: context.profileId
  })
}; 