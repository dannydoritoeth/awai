import { SupabaseClient } from '@supabase/supabase-js'
import { DatabaseResponse, CapabilityGap } from './types'
import { getLevelValue } from './utils'

export async function getCapabilityGaps(
  supabase: SupabaseClient,
  profileId: string,
  targetRoleId: string
): Promise<DatabaseResponse<CapabilityGap[]>> {
  try {
    if (!profileId || !targetRoleId) {
      return {
        data: null,
        error: {
          type: 'INVALID_INPUT',
          message: 'Both profileId and targetRoleId are required'
        }
      }
    }

    // Get role capabilities with a single query joining necessary tables
    const { data: roleCapabilities, error: roleError } = await supabase
      .from('role_capabilities')
      .select(`
        capability_id,
        level as required_level,
        capabilities (
          id,
          name,
          group_name
        )
      `)
      .eq('role_id', targetRoleId)

    if (roleError) {
      return {
        data: null,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Error fetching role capabilities',
          details: roleError
        }
      }
    }

    // Get profile capabilities
    const { data: profileCapabilities, error: profileError } = await supabase
      .from('profile_capabilities')
      .select(`
        capability_id,
        level as profile_level,
        capabilities (
          id,
          name,
          group_name
        )
      `)
      .eq('profile_id', profileId)

    if (profileError) {
      return {
        data: null,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Error fetching profile capabilities',
          details: profileError
        }
      }
    }

    // Create a map of profile capabilities for easy lookup
    const profileCapMap = new Map(
      profileCapabilities?.map(pc => [pc.capability_id, {
        level: pc.profile_level,
        name: pc.capabilities.name,
        groupName: pc.capabilities.group_name
      }]) || []
    )

    // Analyze gaps
    const gaps: CapabilityGap[] = roleCapabilities?.map(rc => {
      const profileCap = profileCapMap.get(rc.capability_id)
      const requiredLevel = rc.required_level
      const profileLevel = profileCap?.level

      // Calculate gap type and severity
      let gapType: 'missing' | 'insufficient' | 'met' = 'missing'
      let severity = 100 // Default to max severity for missing capabilities

      if (profileLevel) {
        const requiredValue = getLevelValue(requiredLevel)
        const profileValue = getLevelValue(profileLevel)

        if (profileValue >= requiredValue) {
          gapType = 'met'
          severity = 0
        } else {
          gapType = 'insufficient'
          // Calculate severity as a percentage of the gap
          severity = ((requiredValue - profileValue) / requiredValue) * 100
        }
      }

      return {
        capabilityId: rc.capability_id,
        name: rc.capabilities.name,
        groupName: rc.capabilities.group_name,
        requiredLevel,
        profileLevel: profileCap?.level,
        gapType,
        severity
      }
    }) || []

    // Sort gaps by severity (highest first) and then by group name
    gaps.sort((a, b) => {
      if (a.severity !== b.severity) {
        return (b.severity || 0) - (a.severity || 0)
      }
      return (a.groupName || '').localeCompare(b.groupName || '')
    })

    return {
      data: gaps,
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