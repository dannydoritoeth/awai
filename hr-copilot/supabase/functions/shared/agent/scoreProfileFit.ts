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
  semanticScore?: number;
  capabilityScore?: number;
  skillScore?: number;
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

    // Get total counts for capabilities and skills
    console.log('Fetching role requirements counts...');
    const { data: totalCounts, error: countsError } = await supabase
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

    // Calculate capability score
    const totalCapabilities = totalCounts?.role_capabilities?.length || 0;
    const missingCapabilities = capabilityGapsResult.data?.filter(gap => gap.gapType === 'missing') || [];
    const insufficientCapabilities = capabilityGapsResult.data?.filter(gap => gap.gapType === 'insufficient') || [];
    const capabilityScore = totalCapabilities > 0 
      ? Math.max(0, 100 * (1 - (missingCapabilities.length * 1.0 + insufficientCapabilities.length * 0.5) / totalCapabilities))
      : 100;

    // Calculate skill score
    const totalSkills = totalCounts?.role_skills?.length || 0;
    const missingSkills = skillGapsResult.data?.filter(gap => gap.gapType === 'missing') || [];
    const insufficientSkills = skillGapsResult.data?.filter(gap => gap.gapType === 'insufficient') || [];
    const skillScore = totalSkills > 0
      ? Math.max(0, 100 * (1 - (missingSkills.length * 1.0 + insufficientSkills.length * 0.5) / totalSkills))
      : 100;

    // Calculate semantic score using embeddings
    let semanticScore = 0;
    try {
      // Get semantic matches using profile ID and table
      const { data: semanticMatch } = await supabase.rpc('match_embeddings_by_vector', {
        p_query_id: { id: profileId, table: 'profiles' },
        p_table_name: 'roles',
        p_match_threshold: 0,
        p_match_count: 1
      });
      semanticScore = semanticMatch?.[0]?.similarity ? semanticMatch[0].similarity * 100 : 0;
    } catch (error) {
      console.log('Error calculating semantic score:', error);
      // Continue with traditional scoring if semantic fails
    }

    // Calculate total score (weighted average)
    const totalScore = Math.round(
      capabilityScore * 0.4 +  // 40% weight on capabilities
      skillScore * 0.3 +       // 30% weight on skills
      semanticScore * 0.3      // 30% weight on semantic similarity
    );

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
        score: totalScore,
        roleId,
        profileId,
        missingCapabilities: missingCapabilities.map(gap => gap.name),
        missingSkills: missingSkills.map(gap => gap.name),
        matchSummary,
        semanticScore,
        capabilityScore,
        skillScore
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