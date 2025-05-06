import { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseResponse } from './types';
import { getCapabilityGaps } from './getCapabilityGaps';
import { getSkillGaps } from './getSkillGaps';

export interface ProfileFitScore {
  profileId: string;
  roleId: string;
  score: number;
  summary: string;
  matchedCapabilities?: string[];
  missingCapabilities?: string[];
  matchedSkills?: string[];
  missingSkills?: string[];
}

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
          capability_id,
          is_critical
        ),
        role_skills (
          skill_id,
          is_critical
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
    const criticalCapabilities = role.role_capabilities.filter(c => c.is_critical).length;
    const totalCapabilities = role.role_capabilities.length;
    
    const matchedCapabilities = capabilityGaps
      .filter(gap => gap.gapType === 'met')
      .map(gap => gap.capabilityId);
    
    const missingCapabilities = capabilityGaps
      .filter(gap => gap.gapType === 'missing' || gap.gapType === 'insufficient')
      .map(gap => gap.capabilityId);

    const matchedCriticalCapabilities = role.role_capabilities
      .filter(c => c.is_critical && matchedCapabilities.includes(c.capability_id))
      .length;

    const capabilityScore = totalCapabilities > 0
      ? ((matchedCapabilities.length / totalCapabilities) * 40) + 
        ((matchedCriticalCapabilities / (criticalCapabilities || 1)) * 20)
      : 60;

    // Calculate skill score (40% weight)
    const skillGaps = skillGapsResult.data || [];
    const criticalSkills = role.role_skills.filter(s => s.is_critical).length;
    const totalSkills = role.role_skills.length;

    const matchedSkills = skillGaps
      .filter(gap => gap.gapType === 'met')
      .map(gap => gap.skillId);

    const missingSkills = skillGaps
      .filter(gap => gap.gapType === 'missing' || gap.gapType === 'insufficient')
      .map(gap => gap.skillId);

    const matchedCriticalSkills = role.role_skills
      .filter(s => s.is_critical && matchedSkills.includes(s.skill_id))
      .length;

    const skillScore = totalSkills > 0
      ? ((matchedSkills.length / totalSkills) * 25) +
        ((matchedCriticalSkills / (criticalSkills || 1)) * 15)
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
  let fitLevel = '';
  if (totalScore >= 90) fitLevel = 'Excellent';
  else if (totalScore >= 75) fitLevel = 'Strong';
  else if (totalScore >= 60) fitLevel = 'Good';
  else if (totalScore >= 40) fitLevel = 'Fair';
  else fitLevel = 'Limited';

  return `${fitLevel} match: ${matchedCapabilities} of ${totalCapabilities} capabilities and ${matchedSkills} of ${totalSkills} skills aligned`;
} 