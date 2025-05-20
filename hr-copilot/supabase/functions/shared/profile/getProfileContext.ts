import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { DatabaseResponse } from '../types.ts';
import { ProfileContext } from '../mcpTypes.ts';

export async function getProfileContext(
  supabase: SupabaseClient,
  profileId: string
): Promise<DatabaseResponse<ProfileContext>> {
  try {
    if (!profileId) {
      return {
        data: null,
        error: {
          type: 'INVALID_INPUT',
          message: 'profileId is required'
        }
      }
    }

    // Get profile data with skills and capabilities
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        email,
        embedding,
        profile_skills (
          skill_id,
          rating,
          skills (
            id,
            name,
            category
          )
        ),
        profile_capabilities (
          capability_id,
          level,
          capabilities (
            id,
            name,
            group_name
          )
        )
      `)
      .eq('id', profileId)
      .single();

    if (profileError || !profile) {
      return {
        data: null,
        error: {
          type: 'NOT_FOUND',
          message: 'Profile not found: ' + profileId,
          details: profileError
        }
      }
    }

    // Get career path data
    const { data: careerPaths, error: careerPathError } = await supabase
      .from('profile_career_paths')
      .select(`
        career_paths (
          id,
          source_role_id,
          target_role_id,
          path_type,
          skill_gap_summary
        )
      `)
      .eq('profile_id', profileId)
      .limit(1)
      .single();

    if (careerPathError && careerPathError.code !== 'PGRST116') {
      return {
        data: null,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Error fetching career path',
          details: careerPathError
        }
      }
    }

    // Get job interactions
    const { data: jobInteractions, error: jobInteractionsError } = await supabase
      .from('profile_job_interactions')
      .select(`
        job_id,
        interaction_type,
        timestamp,
        jobs (
          id,
          title
        )
      `)
      .eq('profile_id', profileId)
      .order('timestamp', { ascending: false })
      .limit(5);

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

    // Format skills and capabilities
    const skills = profile.profile_skills?.map(ps => ({
      id: ps.skill_id,
      name: ps.skills.name,
      category: ps.skills.category,
      level: parseLevel(ps.rating)
    })) || [];

    const capabilities = profile.profile_capabilities?.map(pc => ({
      id: pc.capability_id,
      name: pc.capabilities.name,
      group_name: pc.capabilities.group_name,
      level: parseLevel(pc.level)
    })) || [];

    // Get source and target role titles for career path
    let careerPath: ProfileContext['careerPath'] = null;
    if (careerPaths?.career_paths) {
      const cp = careerPaths.career_paths;
      const [sourceRole, targetRole] = await Promise.all([
        cp.source_role_id ? supabase.from('roles').select('title').eq('id', cp.source_role_id).single() : null,
        cp.target_role_id ? supabase.from('roles').select('title').eq('id', cp.target_role_id).single() : null
      ]);

      careerPath = {
        id: cp.id,
        current_role: sourceRole?.data?.title || '',
        target_role: targetRole?.data?.title || '',
        status: cp.path_type || '',
        progress: 0 // This field doesn't exist in schema, defaulting to 0
      };
    }

    // Format job interactions
    const formattedJobInteractions = (jobInteractions || []).map(ji => ({
      id: ji.jobs.id,
      job_id: ji.job_id,
      status: ji.interaction_type,
      applied_date: ji.timestamp,
      feedback: '' // This field doesn't exist in schema
    }));

    // Construct the profile context
    const profileContext: ProfileContext = {
      profile: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        embedding: profile.embedding,
        skills,
        capabilities
      },
      careerPath,
      jobInteractions: formattedJobInteractions
    };

    return {
      data: profileContext,
      error: null
    };

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

function parseLevel(level: string | null): number {
  if (!level) return 0;
  const num = Number(level);
  if (!isNaN(num)) return num;
  
  switch(level.toLowerCase()) {
    case 'expert':
    case 'high':
      return 5;
    case 'advanced':
      return 4;
    case 'intermediate':
      return 3;
    case 'basic':
    case 'low':
      return 2;
    case 'novice':
    case 'none':
      return 1;
    default:
      return 0;
  }
} 