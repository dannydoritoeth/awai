import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { DatabaseResponse, CapabilityGap, SkillGap } from '../types.ts';
import { getCapabilityGaps } from '../profile/getCapabilityGaps.ts';
import { getSkillGaps } from '../profile/getSkillGaps.ts';
import { rateJobFit } from '../profile/rateJobFit.ts';

export interface MatchingProfile {
  profileId: string;
  name: string;
  matchScore: number;
  missingCapabilities?: string[];
  missingSkills?: string[];
}

export async function getMatchingProfiles(
  supabase: SupabaseClient,
  roleId: string,
  limit: number = 20
): Promise<DatabaseResponse<MatchingProfile[]>> {
  try {
    // First, get all profiles that have any capabilities or skills
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        profile_capabilities (
          capability_id,
          level
        ),
        profile_skills (
          skill_id,
          level
        )
      `)
      .not('profile_capabilities', 'is', null)
      .limit(limit);

    if (profileError) {
      return {
        data: null,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to fetch profiles',
          details: profileError
        }
      };
    }

    // Get role details for comparison
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select(`
        id,
        title,
        role_capabilities (
          capability_id,
          level,
          is_critical
        ),
        role_skills (
          skill_id,
          level,
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

    // Calculate match scores for each profile
    const matchingProfiles: MatchingProfile[] = await Promise.all(
      profiles.map(async (profile) => {
        // Get fit score using existing rateJobFit function
        const fitScore = await rateJobFit(supabase, profile.id, roleId);
        
        if (fitScore.error || !fitScore.data) {
          return {
            profileId: profile.id,
            name: profile.name,
            matchScore: 0,
            missingCapabilities: [],
            missingSkills: []
          };
        }

        return {
          profileId: profile.id,
          name: profile.name,
          matchScore: fitScore.data.score,
          missingCapabilities: fitScore.data.missingCapabilities,
          missingSkills: fitScore.data.missingSkills
        };
      })
    );

    // Sort by match score descending
    const sortedProfiles = matchingProfiles.sort((a, b) => b.matchScore - a.matchScore);

    return {
      data: sortedProfiles,
      error: null
    };
  } catch (error) {
    return {
      data: null,
      error: {
        type: 'DATABASE_ERROR',
        message: 'Failed to get matching profiles',
        details: error
      }
    };
  }
} 