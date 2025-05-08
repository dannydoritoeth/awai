import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { DatabaseResponse } from '../types.ts';

export interface JobPosting {
  jobId: string;
  title: string;
  roleId?: string;
  roleTitle?: string;
  department?: string;
  jobType?: string;
  locations?: string[];
  openDate?: string;
  closeDate?: string;
  remuneration?: string;
  recruiter?: any;
}

export async function getOpenJobs(
  supabase: SupabaseClient,
  roleId?: string,
  limit: number = 20 // Default to 20 jobs max
): Promise<DatabaseResponse<JobPosting[]>> {
  try {
    // Build query for open jobs
    let query = supabase
      .from('jobs')
      .select(`
        id,
        title,
        role_id,
        roles (
          title
        ),
        department,
        job_type,
        locations,
        open_date,
        close_date,
        remuneration,
        recruiter,
        source_url
      `)
      .limit(limit); // Apply the limit to the query

    // Add filters
    if (roleId) {
      query = query.eq('role_id', roleId);
    }

    // Get jobs with limit applied
    const { data: jobs, error: jobsError } = await query;

    if (jobsError) {
      return {
        data: null,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to fetch open jobs',
          details: jobsError
        }
      };
    }

    // Transform the data into the expected format
    // Consider a job open if:
    // 1. It has no close_date, OR
    // 2. close_date is in the future, OR
    // 3. It has no open_date (assuming it's available now), OR
    // 4. open_date is in the past or today
    const now = new Date();
    const openJobs: JobPosting[] = jobs
      .filter(job => {
        const closeDate = job.close_date ? new Date(job.close_date) : null;
        const openDate = job.open_date ? new Date(job.open_date) : null;
        
        return (!closeDate || closeDate > now) && 
               (!openDate || openDate <= now);
      })
      .map(job => ({
        jobId: job.id,
        title: job.title,
        roleId: job.role_id,
        roleTitle: job.roles?.title,
        department: job.department,
        jobType: job.job_type,
        locations: job.locations,
        openDate: job.open_date,
        closeDate: job.close_date,
        remuneration: job.remuneration,
        recruiter: job.recruiter,
        sourceUrl: job.source_url
      }));

    return {
      data: openJobs,
      error: null
    };

  } catch (error) {
    return {
      data: null,
      error: {
        type: 'DATABASE_ERROR',
        message: 'Failed to fetch open jobs',
        details: error
      }
    };
  }
} 