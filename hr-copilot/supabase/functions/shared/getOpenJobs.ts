import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { DatabaseResponse } from './types.ts';

export interface JobPosting {
  jobId: string;
  title: string;
  summary?: string;
  roleId?: string;
  roleTitle?: string;
  location?: string;
  postedAt?: string;
  metadata?: Record<string, any>;
}

export async function getOpenJobs(
  supabase: SupabaseClient,
  roleId?: string
): Promise<DatabaseResponse<JobPosting[]>> {
  try {
    // Start building the query
    let query = supabase
      .from('jobs')
      .select(`
        id as jobId,
        title,
        summary,
        role_id as roleId,
        location,
        posted_at as postedAt,
        metadata,
        roles (
          title as roleTitle
        )
      `)
      .eq('status', 'open')
      .order('posted_at', { ascending: false });

    // Add role filter if provided
    if (roleId) {
      query = query.eq('role_id', roleId);
    }

    const { data: jobs, error } = await query;

    if (error) {
      return {
        data: null,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to fetch open jobs',
          details: error
        }
      };
    }

    // Transform the response to match the JobPosting interface
    const formattedJobs: JobPosting[] = jobs.map(job => ({
      jobId: job.jobId,
      title: job.title,
      summary: job.summary,
      roleId: job.roleId,
      roleTitle: job.roles?.roleTitle,
      location: job.location,
      postedAt: job.postedAt,
      metadata: job.metadata
    }));

    return {
      data: formattedJobs,
      error: null
    };

  } catch (error) {
    return {
      data: null,
      error: {
        type: 'DATABASE_ERROR',
        message: 'Failed to get open jobs',
        details: error
      }
    };
  }
} 