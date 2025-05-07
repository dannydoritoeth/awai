import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { DatabaseResponse, SuggestedPath } from '../types.ts'

export async function getSuggestedCareerPaths(
  supabase: SupabaseClient,
  profileId: string,
  limit: number = 10
): Promise<DatabaseResponse<SuggestedPath[]>> {
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

    // First get the profile's current role title and capabilities
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role_title')
      .eq('id', profileId)
      .single()

    if (profileError) {
      return {
        data: null,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Error fetching profile',
          details: profileError
        }
      }
    }

    // Get profile's capabilities with levels
    const { data: profileCapabilities, error: capabilitiesError } = await supabase
      .from('profile_capabilities')
      .select(`
        capability_id,
        level,
        capabilities (
          name,
          group_name
        )
      `)
      .eq('profile_id', profileId)

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

    // Find the current/inferred role based on role_title
    const { data: currentRole, error: roleError } = await supabase
      .from('roles')
      .select('id, title')
      .ilike('title', profile?.role_title || '')
      .limit(1)
      .single()

    // Get career paths with role details and calculate match scores
    const { data: careerPaths, error: pathsError } = await supabase
      .from('career_paths')
      .select(`
        id,
        path_type,
        source_role:roles!career_paths_source_role_id_fkey (
          id,
          title,
          grade_band
        ),
        target_role:roles!career_paths_target_role_id_fkey (
          id,
          title,
          grade_band
        ),
        role_capabilities!career_paths_target_role_id_fkey (
          capability_id,
          level
        )
      `)
      .eq('source_role_id', currentRole?.id)
      .limit(limit)

    if (pathsError) {
      return {
        data: null,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Error fetching career paths',
          details: pathsError
        }
      }
    }

    // Calculate match scores and format response
    const suggestedPaths: SuggestedPath[] = careerPaths?.map(path => {
      // Calculate capability match score
      const targetCapabilities = path.role_capabilities || []
      const profileCapabilityMap = new Map(
        profileCapabilities?.map(pc => [pc.capability_id, pc.level]) || []
      )
      
      let matchingCapabilities = 0
      let totalCapabilities = targetCapabilities.length
      
      targetCapabilities.forEach(tc => {
        const profileLevel = profileCapabilityMap.get(tc.capability_id)
        if (profileLevel && profileLevel >= tc.level) {
          matchingCapabilities++
        }
      })

      const matchScore = totalCapabilities > 0 
        ? (matchingCapabilities / totalCapabilities) * 100 
        : 0

      // Generate reason based on match score
      let reason = 'Limited capability match'
      if (matchScore >= 80) {
        reason = 'Strong capability match'
      } else if (matchScore >= 50) {
        reason = 'Moderate capability match'
      }

      return {
        fromRoleId: path.source_role.id,
        fromRoleTitle: path.source_role.title,
        toRoleId: path.target_role.id,
        toRoleTitle: path.target_role.title,
        matchScore,
        reason
      }
    }) || []

    // Sort by match score descending
    suggestedPaths.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))

    return {
      data: suggestedPaths,
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