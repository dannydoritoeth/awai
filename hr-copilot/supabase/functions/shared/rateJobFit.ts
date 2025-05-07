import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { DatabaseResponse, JobFitScore } from './types.ts'
import { getCapabilityGaps } from './getCapabilityGaps.ts'
import { getSkillGaps } from './getSkillGaps.ts'

export async function rateJobFit(
  supabase: SupabaseClient,
  profileId: string,
  jobId: string
): Promise<DatabaseResponse<JobFitScore>> {
  try {
    if (!profileId || !jobId) {
      return {
        data: null,
        error: {
          type: 'INVALID_INPUT',
          message: 'Both profileId and jobId are required'
        }
      }
    }

    // First get the role_id from the job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('role_id, title')
      .eq('id', jobId)
      .single()

    if (jobError || !job?.role_id) {
      return {
        data: null,
        error: {
          type: 'NOT_FOUND',
          message: 'Job not found or no role associated',
          details: jobError
        }
      }
    }

    // Get capability gaps
    const { data: capabilityGaps, error: capError } = await getCapabilityGaps(
      supabase,
      profileId,
      job.role_id
    )

    if (capError) {
      return {
        data: null,
        error: capError
      }
    }

    // Get skill gaps
    const { data: skillGaps, error: skillError } = await getSkillGaps(
      supabase,
      profileId,
      job.role_id
    )

    if (skillError) {
      return {
        data: null,
        error: skillError
      }
    }

    // Calculate capability scores
    const matchedCapabilities = capabilityGaps
      ?.filter(gap => gap.gapType === 'met')
      .map(gap => gap.name) || []

    const missingCapabilities = capabilityGaps
      ?.filter(gap => gap.gapType === 'missing')
      .map(gap => gap.name) || []

    const insufficientCapabilities = capabilityGaps
      ?.filter(gap => gap.gapType === 'insufficient')
      .map(gap => gap.name) || []

    const totalCapabilities = capabilityGaps?.length || 0
    const capabilityScore = totalCapabilities > 0
      ? (matchedCapabilities.length / totalCapabilities) * 100
      : 0

    // Calculate skill scores
    const matchedSkills = skillGaps
      ?.filter(gap => gap.gapType === 'met')
      .map(gap => gap.name) || []

    const missingSkills = skillGaps
      ?.filter(gap => gap.gapType === 'missing')
      .map(gap => gap.name) || []

    const insufficientSkills = skillGaps
      ?.filter(gap => gap.gapType === 'insufficient')
      .map(gap => gap.name) || []

    const totalSkills = skillGaps?.length || 0
    const skillScore = totalSkills > 0
      ? (matchedSkills.length / totalSkills) * 100
      : 0

    // Calculate overall score (weighted average: capabilities 60%, skills 40%)
    const score = (capabilityScore * 0.6) + (skillScore * 0.4)

    // Generate summary
    let summary = ''
    if (score >= 80) {
      summary = `Strong match with ${matchedCapabilities.length} of ${totalCapabilities} capabilities and ${matchedSkills.length} of ${totalSkills} skills met`
    } else if (score >= 50) {
      summary = `Moderate match with some gaps: ${insufficientCapabilities.length} capabilities and ${insufficientSkills.length} skills need development`
    } else {
      summary = `Limited match with significant gaps: ${missingCapabilities.length} capabilities and ${missingSkills.length} skills missing`
    }

    const jobFitScore: JobFitScore = {
      score,
      summary,
      matchedCapabilities,
      missingCapabilities,
      matchedSkills,
      missingSkills,
      capabilityScore,
      skillScore
    }

    return {
      data: jobFitScore,
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