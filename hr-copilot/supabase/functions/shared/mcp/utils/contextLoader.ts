import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../database.types.ts';
import { DatabaseResponse, ProfileContext, RoleContext } from '../../mcpTypes.ts';

/**
 * Load profile context including embeddings and related data
 */
export async function loadProfileContext(
  supabase: SupabaseClient<Database>,
  profileId: string
): Promise<DatabaseResponse<ProfileContext>> {
  try {
    // Get profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        email,
        embedding,
        skills (
          id,
          name,
          category,
          level,
          years_experience
        ),
        capabilities (
          id,
          name,
          group_name,
          level
        )
      `)
      .eq('id', profileId)
      .single();

    if (profileError) {
      return {
        data: null,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to load profile data',
          details: profileError
        }
      };
    }

    // Get career path data
    const { data: careerPath, error: careerError } = await supabase
      .from('career_paths')
      .select(`
        id,
        current_role,
        target_role,
        status,
        progress
      `)
      .eq('profile_id', profileId)
      .single();

    if (careerError && careerError.code !== 'PGRST116') { // Ignore not found error
      return {
        data: null,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to load career path data',
          details: careerError
        }
      };
    }

    // Get job interactions
    const { data: jobInteractions, error: jobError } = await supabase
      .from('job_interactions')
      .select(`
        id,
        job_id,
        status,
        applied_date,
        feedback
      `)
      .eq('profile_id', profileId)
      .order('applied_date', { ascending: false })
      .limit(10);

    if (jobError) {
      return {
        data: null,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to load job interactions',
          details: jobError
        }
      };
    }

    return {
      data: {
        profile,
        careerPath: careerPath || null,
        jobInteractions: jobInteractions || []
      },
      error: null
    };

  } catch (error) {
    return {
      data: null,
      error: {
        type: 'INTERNAL_ERROR',
        message: 'Error loading profile context',
        details: error
      }
    };
  }
}

/**
 * Load role context including embeddings and related data
 */
export async function loadRoleContext(
  supabase: SupabaseClient<Database>,
  roleId: string
): Promise<DatabaseResponse<RoleContext>> {
  try {
    // Get role data
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select(`
        id,
        title,
        division_id,
        grade_band,
        location,
        primary_purpose,
        reporting_line,
        direct_reports,
        budget_responsibility,
        capabilities (
          id,
          name,
          group_name,
          level
        ),
        skills (
          id,
          name,
          category,
          required_level,
          required_years
        )
      `)
      .eq('id', roleId)
      .single();

    if (roleError) {
      return {
        data: null,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to load role data',
          details: roleError
        }
      };
    }

    // Get division data if available
    let division = null;
    if (role.division_id) {
      const { data: divisionData, error: divisionError } = await supabase
        .from('divisions')
        .select('*')
        .eq('id', role.division_id)
        .single();

      if (divisionError && divisionError.code !== 'PGRST116') { // Ignore not found error
        return {
          data: null,
          error: {
            type: 'DATABASE_ERROR',
            message: 'Failed to load division data',
            details: divisionError
          }
        };
      }
      division = divisionData;
    }

    return {
      data: {
        role,
        division,
        openings: [] // TODO: Add job openings if needed
      },
      error: null
    };

  } catch (error) {
    return {
      data: null,
      error: {
        type: 'INTERNAL_ERROR',
        message: 'Error loading role context',
        details: error
      }
    };
  }
} 