import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { DatabaseResponse, Profile } from '../types.ts';

export interface ProfileContext {
  profile: Profile;
  skills: Array<{
    id: string;
    name: string;
    category: string;
    rating: string;
    evidence: string;
  }>;
  capabilities: Array<{
    id: string;
    name: string;
    group_name: string;
    level: string;
  }>;
  career_paths: Array<{
    id: string;
    source_role: {
      id: string;
      title: string;
    };
    target_role: {
      id: string;
      title: string;
    };
    path_type: string;
    skill_gap_summary: string;
  }>;
  recent_job_interactions: Array<{
    job_id: string;
    job_title: string;
    interaction_type: string;
    timestamp: string;
  }>;
}

export async function getProfileContext(
  supabase: SupabaseClient,
  profile_id: string
): Promise<DatabaseResponse<ProfileContext>> {
  try {
    if (!profile_id) {
      return {
        data: null,
        error: {
          type: 'INVALID_INPUT',
          message: 'profile_id is required'
        }
      }
    }

    // Get profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profile_id)
      .single()

    if (profileError || !profile) {
      return {
        data: null,
        error: {
          type: 'NOT_FOUND',
          message: 'Profile not found',
          details: profileError
        }
      }
    }

    // Get profile skills with skill details
    const { data: skills, error: skillsError } = await supabase
      .from('profile_skills')
      .select(`
        rating,
        evidence,
        skills (
          id,
          name,
          category
        )
      `)
      .eq('profile_id', profile_id)

    if (skillsError) {
      return {
        data: null,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Error fetching skills',
          details: skillsError
        }
      }
    }

    // Get profile capabilities with capability details
    const { data: capabilities, error: capabilitiesError } = await supabase
      .from('profile_capabilities')
      .select(`
        level,
        capabilities (
          id,
          name,
          group_name
        )
      `)
      .eq('profile_id', profile_id)

    if (capabilitiesError) {
      return {
        data: null,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Error fetching capabilities',
          details: capabilitiesError
        }
      }
    }

    // Get career paths
    const { data: careerPaths, error: careerPathsError } = await supabase
      .from('profile_career_paths')
      .select(`
        career_paths (
          id,
          path_type,
          skill_gap_summary,
          source_role:roles!career_paths_source_role_id_fkey (
            id,
            title
          ),
          target_role:roles!career_paths_target_role_id_fkey (
            id,
            title
          )
        )
      `)
      .eq('profile_id', profile_id)

    if (careerPathsError) {
      return {
        data: null,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Error fetching career paths',
          details: careerPathsError
        }
      }
    }

    // Get recent job interactions
    const { data: jobInteractions, error: jobInteractionsError } = await supabase
      .from('profile_job_interactions')
      .select(`
        interaction_type,
        timestamp,
        jobs (
          id,
          title
        )
      `)
      .eq('profile_id', profile_id)
      .order('timestamp', { ascending: false })
      .limit(5)

    if (jobInteractionsError) {
      return {
        data: null,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Error fetching job interactions',
          details: jobInteractionsError
        }
      }
    }

    // Format the response
    const profileContext: ProfileContext = {
      profile,
      skills: skills?.map(s => ({
        id: s.skills.id,
        name: s.skills.name,
        category: s.skills.category,
        rating: s.rating,
        evidence: s.evidence
      })) || [],
      capabilities: capabilities?.map(c => ({
        id: c.capabilities.id,
        name: c.capabilities.name,
        group_name: c.capabilities.group_name,
        level: c.level
      })) || [],
      career_paths: careerPaths?.map(cp => ({
        id: cp.career_paths.id,
        source_role: cp.career_paths.source_role,
        target_role: cp.career_paths.target_role,
        path_type: cp.career_paths.path_type,
        skill_gap_summary: cp.career_paths.skill_gap_summary
      })) || [],
      recent_job_interactions: jobInteractions?.map(ji => ({
        job_id: ji.jobs.id,
        job_title: ji.jobs.title,
        interaction_type: ji.interaction_type,
        timestamp: ji.timestamp
      })) || []
    }

    return {
      data: profileContext,
      error: null
    }

  } catch (error) {
    return {
      data: null,
      error: {
        type: 'DATABASE_ERROR',
        message: 'Internal server error',
        details: error
      }
    }
  }
} 