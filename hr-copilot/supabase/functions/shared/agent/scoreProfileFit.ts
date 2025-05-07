import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { DatabaseResponse, ProfileFitScore } from '../types.ts';
import { getCapabilityGaps } from '../profile/getCapabilityGaps.ts';
import { getSkillGaps } from '../profile/getSkillGaps.ts';

export async function scoreProfileFit(
  supabase: SupabaseClient,
  profileId: string,
  roleId: string
): Promise<DatabaseResponse<ProfileFitScore>> {
  try {
    // Get capability gaps
    const capabilityGapsResult = await getCapabilityGaps(supabase, profileId, roleId);
    if (capabilityGapsResult.error) {
      return {
        data: null,
        error: capabilityGapsResult.error
      };
    }

    // Get skill gaps
    const skillGapsResult = await getSkillGaps(supabase, profileId, roleId);
    if (skillGapsResult.error) {
      return {
        data: null,
        error: skillGapsResult.error
      };
    }

    // Get role requirements for weighting
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select(`
        id,
        role_capabilities (
          capability_id
        ),
        role_skills (
          skill_id
        )
      `)
      .eq('id', roleId)
      .single();

    if (roleError || !role) {
      return {
        data: null,
        error: {
          type: 'NOT_FOUND',
          message: 'Role not found',
          details: roleError
        }
      };
    }

    // Calculate capability score (60% weight)
    const capabilityGaps = capabilityGapsResult.data || [];
    const totalCapabilities = role.role_capabilities.length;
    
    const matchedCapabilities = capabilityGaps
      .filter(gap => gap.gapType === 'met')
      .map(gap => gap.capabilityId);
    
    const missingCapabilities = capabilityGaps
      .filter(gap => gap.gapType === 'missing' || gap.gapType === 'insufficient')
      .map(gap => gap.capabilityId);

    const capabilityScore = totalCapabilities > 0
      ? (matchedCapabilities.length / totalCapabilities) * 60
      : 60;

    // Calculate skill score (40% weight)
    const skillGaps = skillGapsResult.data || [];
    const totalSkills = role.role_skills.length;

    const matchedSkills = skillGaps
      .filter(gap => gap.gapType === 'met')
      .map(gap => gap.skillId);

    const missingSkills = skillGaps
      .filter(gap => gap.gapType === 'missing' || gap.gapType === 'insufficient')
      .map(gap => gap.skillId);

    const skillScore = totalSkills > 0
      ? (matchedSkills.length / totalSkills) * 40
      : 40;

    // Calculate total score
    const totalScore = Math.round(capabilityScore + skillScore);

    // Generate summary
    const summary = generateSummary(
      matchedCapabilities.length,
      totalCapabilities,
      matchedSkills.length,
      totalSkills,
      totalScore
    );

    return {
      data: {
        profileId,
        roleId,
        score: totalScore,
        summary,
        matchedCapabilities,
        missingCapabilities,
        matchedSkills,
        missingSkills
      },
      error: null
    };
  } catch (error) {
    return {
      data: null,
      error: {
        type: 'DATABASE_ERROR',
        message: 'Failed to calculate profile fit score',
        details: error
      }
    };
  }
}

function generateSummary(
  matchedCapabilities: number,
  totalCapabilities: number,
  matchedSkills: number,
  totalSkills: number,
  totalScore: number
): string {
  let readinessLevel = '';
  if (totalScore >= 90) readinessLevel = 'Fully ready';
  else if (totalScore >= 75) readinessLevel = 'Well prepared';
  else if (totalScore >= 60) readinessLevel = 'Mostly prepared';
  else if (totalScore >= 40) readinessLevel = 'Partially prepared';
  else readinessLevel = 'Additional preparation needed';

  return `${readinessLevel}: ${matchedCapabilities} of ${totalCapabilities} capabilities and ${matchedSkills} of ${totalSkills} skills aligned`;
} 