import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { DatabaseResponse } from '../types.ts';

export interface RoleDetail {
  roleId: string;
  title: string;
  divisionId?: string;
  divisionName?: string;
  gradeBand?: string;
  location?: string;
  primaryPurpose?: string;
  reportingLine?: string;
  directReports?: string;
  budgetResponsibility?: string;
  capabilities: {
    capabilityId: string;
    name: string;
    level?: string;
    capabilityType?: string;
  }[];
}

/**
 * Find a role by title using fuzzy matching
 */
export async function findRoleByTitle(
  supabase: SupabaseClient,
  title: string
): Promise<DatabaseResponse<{ id: string; title: string }>> {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('id, title')
      .ilike('title', `%${title}%`)
      .limit(1)
      .single();

    if (error) {
      return {
        data: null,
        error: {
          type: 'NOT_FOUND',
          message: 'Role not found',
          details: error
        }
      };
    }

    return {
      data: {
        id: data.id,
        title: data.title
      },
      error: null
    };
  } catch (error) {
    return {
      data: null,
      error: {
        type: 'DATABASE_ERROR',
        message: 'Failed to search for role',
        details: error
      }
    };
  }
}

export async function getRoleDetail(
  supabase: SupabaseClient,
  roleId: string
): Promise<DatabaseResponse<RoleDetail>> {
  try {
    if (!roleId) {
      return {
        data: null,
        error: {
          type: 'INVALID_INPUT',
          message: 'roleId is required'
        }
      };
    }

    // Get role data with capabilities in a single query
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select(`
        id,
        title,
        division_id,
        divisions (
          id,
          name
        ),
        grade_band,
        location,
        primary_purpose,
        reporting_line,
        direct_reports,
        budget_responsibility,
        role_capabilities (
          capability_id,
          level,
          capability_type,
          capabilities (
            id,
            name
          )
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

    // Transform the data into the expected format
    const roleDetail: RoleDetail = {
      roleId: role.id,
      title: role.title,
      divisionId: role.division_id,
      divisionName: role.divisions?.name,
      gradeBand: role.grade_band,
      location: role.location,
      primaryPurpose: role.primary_purpose,
      reportingLine: role.reporting_line,
      directReports: role.direct_reports,
      budgetResponsibility: role.budget_responsibility,
      capabilities: role.role_capabilities?.map(rc => ({
        capabilityId: rc.capabilities.id,
        name: rc.capabilities.name,
        level: rc.level || undefined,
        capabilityType: rc.capability_type
      })) || []
    };

    return {
      data: roleDetail,
      error: null
    };

  } catch (error) {
    return {
      data: null,
      error: {
        type: 'DATABASE_ERROR',
        message: 'Failed to fetch role details',
        details: error
      }
    };
  }
} 