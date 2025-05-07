import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { DatabaseResponse } from '../types.ts';

export interface CareerPathSuggestion {
  pathId: string;
  sourceRole: {
    roleId: string;
    title: string;
  };
  targetRole: {
    roleId: string;
    title: string;
  };
  pathType?: string;
  skillGapSummary?: string;
  popularityScore?: number;
  supportingEvidence?: string[];
}

export async function getSuggestedCareerPaths(
  supabase: SupabaseClient,
  profileId: string
): Promise<DatabaseResponse<CareerPathSuggestion[]>> {
  try {
    if (!profileId) {
      return {
        data: null,
        error: {
          type: 'INVALID_INPUT',
          message: 'profileId is required'
        }
      };
    }

    // First get the profile's current role title
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role_title')
      .eq('id', profileId)
      .single();

    if (profileError) {
      return {
        data: null,
        error: {
          type: 'NOT_FOUND',
          message: 'Profile not found',
          details: profileError
        }
      };
    }

    // Get career paths with role details
    const { data: careerPaths, error: pathsError } = await supabase
      .from('career_paths')
      .select(`
        id,
        path_type,
        skill_gap_summary,
        popularity_score,
        supporting_evidence,
        source_role:roles!career_paths_source_role_id_fkey (
          id,
          title
        ),
        target_role:roles!career_paths_target_role_id_fkey (
          id,
          title
        )
      `);

    if (pathsError) {
      return {
        data: null,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Error fetching career paths',
          details: pathsError
        }
      };
    }

    // Transform the data into the expected format
    const suggestions: CareerPathSuggestion[] = careerPaths
      .filter(path => path.source_role && path.target_role) // Ensure both roles exist
      .map(path => ({
        pathId: path.id,
        sourceRole: {
          roleId: path.source_role.id,
          title: path.source_role.title
        },
        targetRole: {
          roleId: path.target_role.id,
          title: path.target_role.title
        },
        pathType: path.path_type,
        skillGapSummary: path.skill_gap_summary,
        popularityScore: path.popularity_score,
        supportingEvidence: path.supporting_evidence
      }));

    return {
      data: suggestions,
      error: null
    };

  } catch (error) {
    return {
      data: null,
      error: {
        type: 'DATABASE_ERROR',
        message: 'Failed to fetch career path suggestions',
        details: error
      }
    };
  }
} 