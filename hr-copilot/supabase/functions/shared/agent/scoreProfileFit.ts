import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { DatabaseResponse } from '../types.ts';
import { getCapabilityGaps } from '../profile/getCapabilityGaps.ts';
import { getSkillGaps } from '../profile/getSkillGaps.ts';
import { getSemanticMatches } from '../embeddings.ts';

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

export interface BatchScoreResult {
  roleId: string;
  result: DatabaseResponse<ProfileFitScore>;
}

/**
 * Pre-filter roles using semantic similarity to find the most promising candidates
 */
async function preFilterRoles(
  supabase: SupabaseClient,
  profileId: string,
  roleIds: string[],
  limit: number = 10
): Promise<string[]> {
  try {
    // Get semantic matches for the profile against all roles
    const matches = await getSemanticMatches(
      supabase,
      { id: profileId, table: 'profiles' },
      'roles',
      limit,
      0.3 // Lower threshold to cast a wider net
    );

    // Filter matches to only include roles we're interested in
    const filteredMatches = matches
      .filter(match => roleIds.includes(match.id))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    // If we don't get enough semantic matches, include some random roles to meet the limit
    const selectedIds = filteredMatches.map(m => m.id);
    if (selectedIds.length < limit) {
      const remainingRoles = roleIds.filter(id => !selectedIds.includes(id));
      const additionalCount = Math.min(limit - selectedIds.length, remainingRoles.length);
      if (additionalCount > 0) {
        // Shuffle remaining roles and take what we need
        const shuffled = remainingRoles.sort(() => Math.random() - 0.5);
        selectedIds.push(...shuffled.slice(0, additionalCount));
      }
    }

    return selectedIds;
  } catch (error) {
    console.error('Error in preFilterRoles:', error);
    // On error, return a subset of the original roles
    return roleIds.slice(0, limit);
  }
}

/**
 * Score profile fit against multiple roles in parallel, with pre-filtering
 */
export async function batchScoreProfileFit(
  supabase: SupabaseClient,
  profileId: string,
  roleIds: string[],
  options: {
    maxConcurrent?: number;
    continueOnError?: boolean;
    maxRoles?: number;
  } = {}
): Promise<BatchScoreResult[]> {
  const { maxConcurrent = 5, continueOnError = true, maxRoles = 10 } = options;

  // Pre-filter roles to get the most promising candidates
  const filteredRoleIds = await preFilterRoles(supabase, profileId, roleIds, maxRoles);
  console.log(`Pre-filtered from ${roleIds.length} to ${filteredRoleIds.length} roles`);

  // Process filtered roles in chunks
  const results: BatchScoreResult[] = [];
  for (let i = 0; i < filteredRoleIds.length; i += maxConcurrent) {
    const chunk = filteredRoleIds.slice(i, i + maxConcurrent);
    
    const chunkPromises = chunk.map(async (roleId): Promise<BatchScoreResult> => {
      try {
        const result = await scoreProfileFit(supabase, profileId, roleId);
        return { roleId, result };
      } catch (error) {
        if (!continueOnError) {
          throw error;
        }
        console.error(`Error scoring role ${roleId}:`, error);
        return {
          roleId,
          result: {
            data: null,
            error: {
              type: 'DATABASE_ERROR',
              message: 'Failed to score profile fit',
              details: error
            }
          }
        };
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
  }

  // Sort results by score (if available) before returning
  return results.sort((a, b) => {
    const scoreA = a.result.data?.score ?? 0;
    const scoreB = b.result.data?.score ?? 0;
    return scoreB - scoreA;
  });
}

/**
 * Score profile fit for a single role
 */
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

    // Run gap analysis in parallel
    const [capabilityGapsResult, skillGapsResult, roleCounts] = await Promise.all([
      getCapabilityGaps(supabase, profileId, roleId),
      getSkillGaps(supabase, profileId, roleId),
      supabase
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
        .single()
    ]);

    // Handle errors from parallel requests
    if (capabilityGapsResult.error) {
      console.log('Error getting capability gaps:', capabilityGapsResult.error);
      return {
        data: null,
        error: capabilityGapsResult.error
      };
    }

    if (skillGapsResult.error) {
      console.log('Error getting skill gaps:', skillGapsResult.error);
      return {
        data: null,
        error: skillGapsResult.error
      };
    }

    if (!roleCounts || roleCounts.error) {
      console.log('Error getting role requirements counts:', roleCounts?.error);
      return {
        data: null,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to get role requirements counts',
          details: roleCounts?.error
        }
      };
    }

    // Calculate capability score
    const totalCapabilities = roleCounts.data?.role_capabilities?.length || 0;
    const missingCapabilities = capabilityGapsResult.data?.filter(gap => gap.gapType === 'missing') || [];
    const insufficientCapabilities = capabilityGapsResult.data?.filter(gap => gap.gapType === 'insufficient') || [];
    const capabilityScore = totalCapabilities > 0 
      ? Math.max(0, 100 * (1 - (missingCapabilities.length * 1.0 + insufficientCapabilities.length * 0.5) / totalCapabilities))
      : 100;

    // Calculate skill score
    const totalSkills = roleCounts.data?.role_skills?.length || 0;
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

/**
 * Score multiple profiles against a single role in parallel, with pre-filtering
 */
export async function batchScoreRoleProfiles(
  supabase: SupabaseClient,
  roleId: string,
  profileIds: string[],
  options: {
    maxConcurrent?: number;
    continueOnError?: boolean;
    maxProfiles?: number;
  } = {}
): Promise<BatchScoreResult[]> {
  const { maxConcurrent = 5, continueOnError = true, maxProfiles = 20 } = options;

  // Pre-filter profiles to get the most promising candidates using semantic search
  const matches = await getSemanticMatches(
    supabase,
    { id: roleId, table: 'roles' },
    'profiles',
    maxProfiles,
    0.3 // Lower threshold to cast a wider net
  );

  // Filter matches to only include profiles we're interested in
  const filteredProfileIds = matches
    .filter(match => profileIds.includes(match.id))
    .map(match => match.id);

  // Add any remaining profiles up to maxProfiles if we don't have enough matches
  if (filteredProfileIds.length < maxProfiles) {
    const remainingProfiles = profileIds
      .filter(id => !filteredProfileIds.includes(id))
      .slice(0, maxProfiles - filteredProfileIds.length);
    filteredProfileIds.push(...remainingProfiles);
  }

  console.log(`Pre-filtered from ${profileIds.length} to ${filteredProfileIds.length} profiles`);

  // Process filtered profiles in chunks
  const results: BatchScoreResult[] = [];
  for (let i = 0; i < filteredProfileIds.length; i += maxConcurrent) {
    const chunk = filteredProfileIds.slice(i, i + maxConcurrent);
    
    const chunkPromises = chunk.map(async (profileId): Promise<BatchScoreResult> => {
      try {
        const result = await scoreProfileFit(supabase, profileId, roleId);
        return { roleId: profileId, result }; // Note: we use roleId field to store profileId for consistency
      } catch (error) {
        if (!continueOnError) {
          throw error;
        }
        console.error(`Error scoring profile ${profileId}:`, error);
        return {
          roleId: profileId, // Note: we use roleId field to store profileId for consistency
          result: {
            data: null,
            error: {
              type: 'DATABASE_ERROR',
              message: 'Failed to score profile fit',
              details: error
            }
          }
        };
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
  }

  // Sort results by score (if available) before returning
  return results.sort((a, b) => {
    const scoreA = a.result.data?.score ?? 0;
    const scoreB = b.result.data?.score ?? 0;
    return scoreB - scoreA;
  });
} 