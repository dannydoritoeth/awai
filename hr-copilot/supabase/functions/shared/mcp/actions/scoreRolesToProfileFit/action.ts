/**
 * @fileoverview Scores the fit between one or more roles and a profile using structured logic
 * 
 * Purpose: Evaluates and scores how well roles match a profile's capabilities and skills.
 * Uses weighted scoring without AI for consistent, objective results. Mirror implementation
 * of scoreProfilesToRoleFit but for scoring multiple roles against a single profile.
 * 
 * Inputs:
 * - profileId: ID of the profile to evaluate roles against
 * - roleIds: Array of role IDs to evaluate
 * 
 * Outputs:
 * - Structured scoring data for each role
 * - Detailed breakdown of capability and skill alignment
 * - Explanatory text for the scores
 * 
 * Related Actions:
 * - getMatchingRolesForPerson: Uses this for role recommendations
 * - getCapabilityGaps: Similar analysis but focused on gaps
 * - getSkillGaps: Similar analysis for skills specifically
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../../database.types.ts';
import { MCPRequest, MCPResponse, MCPActionV2 } from '../../types/action.ts';
import { getRoleDetail } from '../../../role/getRoleDetail.ts';
import { getProfileData } from '../../../profile/getProfileData.ts';
import { logAgentProgress } from '../../../chatUtils.ts';
import { getLevelValue } from '../../../utils.ts';

interface ScoreRolesArgs extends MCPRequest {
  profileId: string;
  roleIds: string[];
}

interface RoleScore {
  score: number;
  explanation: string;
  factors: {
    capabilityAlignment: number;
    skillAlignment: number;
  };
  details: {
    capabilities: {
      met: string[];
      insufficient: string[];
      missing: string[];
      score: number;
    };
    skills: {
      met: string[];
      insufficient: string[];
      missing: string[];
      score: number;
    };
  };
}

interface ScoreResponse {
  scores: {
    [roleId: string]: RoleScore;
  };
}

async function scoreRolesToProfileFitBase(request: MCPRequest): Promise<MCPResponse<ScoreResponse>> {
  const supabase = request.supabase as SupabaseClient<Database>;
  const args = request as ScoreRolesArgs;
  const { profileId, roleIds, sessionId } = args;

  try {
    // Input validation
    if (!profileId || !roleIds?.length) {
      throw new Error('Both profileId and roleIds are required');
    }

    // Log starting analysis
    if (sessionId) {
      await logAgentProgress(
        supabase,
        sessionId,
        `Analyzing fit scores for ${roleIds.length} roles...`,
        { phase: 'analysis_start' }
      );
    }

    // Get profile capabilities and skills
    const [profileCapabilities, profileSkills] = await Promise.all([
      supabase
        .from('profile_capabilities')
        .select('capability_id, level, capabilities!inner(name)')
        .eq('profile_id', profileId),
      supabase
        .from('profile_skills')
        .select('skill_id, rating, skills!inner(name)')
        .eq('profile_id', profileId)
    ]);

    if (profileCapabilities.error || profileSkills.error) {
      throw new Error('Failed to load profile requirements');
    }

    const scores: { [roleId: string]: RoleScore } = {};

    // Process each role
    for (const roleId of roleIds) {
      // Get role capabilities and skills
      const [roleCapabilities, roleSkills] = await Promise.all([
        supabase
          .from('role_capabilities')
          .select('capability_id, level, capabilities!inner(name)')
          .eq('role_id', roleId),
        supabase
          .from('role_skills')
          .select('skill_id, skills!inner(name)')
          .eq('role_id', roleId)
      ]);

      if (roleCapabilities.error || roleSkills.error) {
        console.error(`Error loading role ${roleId} data:`, {
          capError: roleCapabilities.error,
          skillError: roleSkills.error
        });
        continue;
      }

      // Score capabilities
      const capabilityAnalysis = {
        met: [] as string[],
        insufficient: [] as string[],
        missing: [] as string[]
      };

      for (const roleCap of roleCapabilities.data || []) {
        const profileCap = profileCapabilities.data?.find(
          pc => pc.capability_id === roleCap.capability_id
        );

        if (!profileCap) {
          capabilityAnalysis.missing.push(roleCap.capabilities.name);
        } else {
          const roleLevel = getLevelValue(roleCap.level);
          const profileLevel = getLevelValue(profileCap.level);

          if (profileLevel >= roleLevel) {
            capabilityAnalysis.met.push(roleCap.capabilities.name);
          } else {
            capabilityAnalysis.insufficient.push(roleCap.capabilities.name);
          }
        }
      }

      // Score skills
      const skillAnalysis = {
        met: [] as string[],
        insufficient: [] as string[],
        missing: [] as string[]
      };

      for (const roleSkill of roleSkills.data || []) {
        const profileSkill = profileSkills.data?.find(
          ps => ps.skill_id === roleSkill.skill_id
        );

        if (!profileSkill) {
          skillAnalysis.missing.push(roleSkill.skills.name);
        } else {
          const profileLevel = getLevelValue(profileSkill.rating);
          if (profileLevel >= 3) { // Assuming role requires at least intermediate level
            skillAnalysis.met.push(roleSkill.skills.name);
          } else {
            skillAnalysis.insufficient.push(roleSkill.skills.name);
          }
        }
      }

      // Calculate scores
      const capabilityScore = roleCapabilities.data?.length ?
        capabilityAnalysis.met.length / roleCapabilities.data.length : 0;
      
      const skillScore = roleSkills.data?.length ?
        skillAnalysis.met.length / roleSkills.data.length : 0;

      // Combined weighted score (60% capabilities, 40% skills)
      const totalScore = (capabilityScore * 0.6) + (skillScore * 0.4);

      // Generate explanation
      const explanation = `Matches ${capabilityAnalysis.met.length} of ${roleCapabilities.data?.length || 0} required capabilities and ${skillAnalysis.met.length} of ${roleSkills.data?.length || 0} required skills.`;

      scores[roleId] = {
        score: totalScore,
        explanation,
        factors: {
          capabilityAlignment: capabilityScore,
          skillAlignment: skillScore
        },
        details: {
          capabilities: {
            ...capabilityAnalysis,
            score: capabilityScore
          },
          skills: {
            ...skillAnalysis,
            score: skillScore
          }
        }
      };
    }

    // Get profile data for context
    const profileData = await getProfileData(supabase, profileId);
    if (!profileData) {
      throw new Error('Could not load profile data');
    }

    // Log completion
    if (sessionId) {
      await logAgentProgress(
        supabase,
        sessionId,
        `Completed fit analysis for ${Object.keys(scores).length} roles.`,
        { phase: 'analysis_complete' }
      );
    }

    return {
      success: true,
      message: `Scored ${Object.keys(scores).length} roles`,
      data: {
        scores
      },
      dataForDownstreamPrompt: {
        scoreRolesToProfileFit: {
          dataSummary: `Analyzed ${Object.keys(scores).length} roles for profile ${profileData.name}`,
          structured: {
            profileId,
            profileName: profileData.name,
            roleCount: Object.keys(scores).length,
            scores: Object.entries(scores).map(([id, score]) => ({
              roleId: id,
              score: score.score,
              capabilityScore: score.factors.capabilityAlignment,
              skillScore: score.factors.skillAlignment
            }))
          },
          truncated: false
        }
      }
    };

  } catch (error) {
    console.error('Error in scoreRolesToProfileFit:', error);

    const errorMessage = "I encountered an error while scoring roles. Please try again.";
    
    if (sessionId) {
      await logAgentProgress(
        supabase,
        sessionId,
        errorMessage,
        { phase: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      error: {
        type: 'SCORING_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error
      }
    };
  }
}

// Create the MCPActionV2 implementation
export const scoreRolesToProfileFit: MCPActionV2 = {
  id: 'scoreRolesToProfileFit',
  title: 'Score Roles to Profile Fit',
  description: 'Score how well one or more roles match a profile\'s capabilities and skills',
  applicableRoles: ['candidate', 'career_coach', 'analyst'],
  capabilityTags: ['Career Development', 'Role Analysis', 'Fit Analysis'],
  requiredInputs: ['profileId', 'roleIds'],
  tags: ['scoring', 'fit_estimation', 'batch'],
  recommendedAfter: ['getProfileContext'],
  recommendedBefore: ['getMatchingRolesForPerson', 'getCapabilityGaps'],
  usesAI: false,
  actionFn: (ctx: Record<string, any>) => scoreRolesToProfileFitBase(ctx as MCPRequest),
  getDefaultArgs: (context: Record<string, any>) => ({
    profileId: context.profileId,
    roleIds: Array.isArray(context.roleIds) ? context.roleIds : 
             context.roleId ? [context.roleId] : []
  })
};

export default scoreRolesToProfileFit; 