import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { DatabaseResponse, SkillGap } from '../types.ts'
import { getLevelValue } from '../utils.ts'

export async function getSkillGaps(
  supabase: SupabaseClient,
  profileId: string,
  targetRoleId: string
): Promise<DatabaseResponse<SkillGap[]>> {
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

    // Get role skills with a single query joining necessary tables
    const { data: roleSkills, error: roleError } = await supabase
      .from('role_skills')
      .select(`
        skill_id,
        skills (
          id,
          name,
          category
        )
      `)
      .eq('role_id', targetRoleId)

    if (roleError) {
      return {
        data: null,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Error fetching role skills',
          details: roleError
        }
      }
    }

    // Get profile skills
    const { data: profileSkills, error: profileError } = await supabase
      .from('profile_skills')
      .select(`
        skill_id,
        rating,
        skills (
          id,
          name,
          category
        )
      `)
      .eq('profile_id', profileId)

    if (profileError) {
      return {
        data: null,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Error fetching profile skills',
          details: profileError
        }
      }
    }

    // Create a map of profile skills for easy lookup
    const profileSkillMap = new Map(
      profileSkills?.map(ps => [ps.skill_id, {
        level: ps.rating,
        name: ps.skills.name,
        category: ps.skills.category
      }]) || []
    )

    // Analyze gaps
    const gaps: SkillGap[] = roleSkills?.map(rs => {
      const profileSkill = profileSkillMap.get(rs.skill_id)
      const requiredLevel = rs.level
      const profileLevel = profileSkill?.level

      // Calculate gap type and severity
      let gapType: 'missing' | 'insufficient' | 'met' = 'missing'
      let severity = 100 // Default to max severity for missing skills

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
        skillId: rs.skill_id,
        name: rs.skills.name,
        category: rs.skills.category,
        requiredLevel,
        profileLevel: profileSkill?.level,
        gapType,
        severity
      }
    }) || []

    // Sort gaps by severity (highest first) and then by category
    gaps.sort((a, b) => {
      if (a.severity !== b.severity) {
        return (b.severity || 0) - (a.severity || 0)
      }
      return (a.category || '').localeCompare(b.category || '')
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