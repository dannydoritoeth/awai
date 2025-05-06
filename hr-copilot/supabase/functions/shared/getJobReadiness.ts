import { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseResponse } from './types';
import { scoreProfileFit } from './scoreProfileFit';

export interface JobReadiness {
  jobId: string;
  roleId: string;
  score: number;
  summary: string;
  missingCapabilities?: string[];
  missingSkills?: string[];
}

export async function getJobReadiness(
  supabase: SupabaseClient,
  profileId: string,
  jobId: string
): Promise<DatabaseResponse<JobReadiness>> {
  try {
    // Get the job and its associated role
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        id,
        role_id,
        title
      `)
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return {
        data: null,
        error: {
          type: 'NOT_FOUND',
          message: 'Job not found',
          details: jobError
        }
      };
    }

    // Get the profile fit score for the associated role
    const fitScore = await scoreProfileFit(supabase, profileId, job.role_id);
    
    if (fitScore.error) {
      return {
        data: null,
        error: fitScore.error
      };
    }

    // Transform the fit score into job readiness
    const readiness: JobReadiness = {
      jobId,
      roleId: job.role_id,
      score: fitScore.data!.score,
      summary: generateReadinessSummary(job.title, fitScore.data!),
      missingCapabilities: fitScore.data!.missingCapabilities,
      missingSkills: fitScore.data!.missingSkills
    };

    return {
      data: readiness,
      error: null
    };

  } catch (error) {
    return {
      data: null,
      error: {
        type: 'DATABASE_ERROR',
        message: 'Failed to calculate job readiness',
        details: error
      }
    };
  }
}

function generateReadinessSummary(
  jobTitle: string,
  fitScore: {
    score: number;
    matchedCapabilities?: string[];
    missingCapabilities?: string[];
    matchedSkills?: string[];
    missingSkills?: string[];
  }
): string {
  const totalCapabilities = (fitScore.matchedCapabilities?.length || 0) + 
                          (fitScore.missingCapabilities?.length || 0);
  const totalSkills = (fitScore.matchedSkills?.length || 0) + 
                     (fitScore.missingSkills?.length || 0);
  
  let readinessLevel = '';
  if (fitScore.score >= 90) readinessLevel = 'Fully ready';
  else if (fitScore.score >= 75) readinessLevel = 'Well prepared';
  else if (fitScore.score >= 60) readinessLevel = 'Mostly prepared';
  else if (fitScore.score >= 40) readinessLevel = 'Partially prepared';
  else readinessLevel = 'Additional preparation needed';

  const matchedCapabilities = fitScore.matchedCapabilities?.length || 0;
  const matchedSkills = fitScore.matchedSkills?.length || 0;

  return `${readinessLevel} for ${jobTitle}: ${matchedCapabilities} of ${totalCapabilities} capabilities and ${matchedSkills} of ${totalSkills} skills aligned`;
} 