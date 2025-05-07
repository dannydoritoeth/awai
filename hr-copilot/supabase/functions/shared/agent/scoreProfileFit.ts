import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { DatabaseResponse } from '../types.ts';
import { getCapabilityGaps } from '../profile/getCapabilityGaps.ts';
import { getSkillGaps } from '../profile/getSkillGaps.ts';

export interface ProfileFitScore {
  score: number;
  roleId: string;
  profileId: string;
  missingCapabilities?: string[];
  missingSkills?: string[];
  matchSummary?: string;
}

export async function scoreProfileFit(
  supabase: SupabaseClient,
  profileId: string,
  roleId: string
): Promise<DatabaseResponse<ProfileFitScore>> {
  try {
    console.log('Starting scoreProfileFit calculation:', { profileId, roleId });

    if (!profileId || !roleId) {
      console.log('Invalid input - missing profileId or roleId');
      return {
        data: null,
        error: {
          type: 'INVALID_INPUT',
          message: 'Both profileId and roleId are required'
        }
      };
    }

    // Get capability gaps
    console.log('Fetching capability gaps...');
    const capabilityGapsResult = await getCapabilityGaps(supabase, profileId, roleId);
    if (capabilityGapsResult.error) {
      console.log('Error getting capability gaps:', capabilityGapsResult.error);
      return {
        data: null,
        error: capabilityGapsResult.error
      };
    }
    console.log('Capability gaps found:', capabilityGapsResult.data?.length || 0);

    // Get skill gaps
    console.log('Fetching skill gaps...');
    const skillGapsResult = await getSkillGaps(supabase, profileId, roleId);
    if (skillGapsResult.error) {
      console.log('Error getting skill gaps:', skillGapsResult.error);
      return {
        data: null,
        error: skillGapsResult.error
      };
    }
    console.log('Skill gaps found:', skillGapsResult.data?.length || 0);

    // Calculate scores
    const capabilityGaps = capabilityGapsResult.data || [];
    const skillGaps = skillGapsResult.data || [];

    // Get total counts for capabilities and skills
    console.log('Fetching role requirements counts...');
    const { data: totalCounts, error: countsError } = await supabase
      .from('roles')
      .select(`
        id,
        role_capabilities!role_capabilities_role_id_fkey (count),
        role_skills!role_skills_role_id_fkey (count)
      `)
      .eq('id', roleId)
      .single();

    if (countsError) {
      console.log('Error getting role requirements counts:', countsError);
      return {
        data: null,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to get role requirements counts',
          details: countsError
        }
      };
    }
    console.log('Role requirements counts:', totalCounts);

    const totalCapabilities = totalCounts?.role_capabilities?.length || 0;
    const totalSkills = totalCounts?.role_skills?.length || 0;

    console.log('Calculating scores with totals:', { totalCapabilities, totalSkills });

    // Calculate fit scores
    const capabilityScore = totalCapabilities > 0 
      ? (totalCapabilities - capabilityGaps.length) / totalCapabilities 
      : 1;
    
    const skillScore = totalSkills > 0
      ? (totalSkills - skillGaps.length) / totalSkills
      : 1;

    console.log('Individual scores:', { capabilityScore, skillScore });

    // Weighted average (capabilities count more than skills)
    const totalScore = (capabilityScore * 0.7 + skillScore * 0.3) * 100;
    console.log('Total weighted score:', totalScore);

    // Generate match summary
    let matchSummary = '';
    if (totalScore >= 80) {
      matchSummary = 'Excellent fit with strong capability and skill alignment';
    } else if (totalScore >= 60) {
      matchSummary = 'Good fit with some gaps in capabilities or skills';
    } else if (totalScore >= 40) {
      matchSummary = 'Moderate fit with significant development needs';
    } else {
      matchSummary = 'Limited fit with major capability and skill gaps';
    }

    const result = {
      data: {
        score: Math.round(totalScore),
        roleId,
        profileId,
        missingCapabilities: capabilityGaps.map(gap => gap.name),
        missingSkills: skillGaps.map(gap => gap.name),
        matchSummary
      },
      error: null
    };
    console.log('Final result:', result);
    return result;

  } catch (error) {
    console.log('Unexpected error in scoreProfileFit:', error);
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