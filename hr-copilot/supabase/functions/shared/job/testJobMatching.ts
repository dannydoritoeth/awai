import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { getOpenJobs } from './getOpenJobs.ts';
import { getProfileData } from '../profile/getProfileData.ts';
import { getRolesData } from '../role/getRoleData.ts';
import { calculateJobReadiness, generateJobSummary } from './jobReadiness.ts';
import { getSemanticMatches } from '../embeddings.ts';

export interface JobMatch {
  jobId: string;
  jobTitle: string;
  roleId: string;
  score: number;
  semanticScore: number;
  summary: string;
}

export async function testJobMatching(
  supabase: SupabaseClient<Database>,
  profileId: string,
  options = { limit: 20, threshold: 0.7 }
): Promise<{ matches: JobMatch[], debug: any }> {
  const debug: any = {
    timings: {},
    counts: {},
    errors: []
  };
  const startTime = Date.now();

  try {
    console.log('Starting job matching test...');
    
    // 1. Get open jobs
    console.log('Fetching open jobs...');
    const openJobs = await getOpenJobs(supabase, undefined, options.limit);
    debug.timings.getJobs = Date.now() - startTime;
    debug.counts.totalJobs = openJobs.data?.length || 0;
    
    if (openJobs.error) {
      console.error('Error fetching jobs:', openJobs.error);
      debug.errors.push({ step: 'getJobs', error: openJobs.error });
      return { matches: [], debug };
    }

    if (!openJobs.data || openJobs.data.length === 0) {
      console.log('No open jobs found');
      return { matches: [], debug };
    }

    // 2. Extract role IDs
    const roleIds = openJobs.data
      .map(job => job.roleId)
      .filter((id): id is string => !!id);
    debug.counts.rolesWithIds = roleIds.length;
    console.log(`Found ${roleIds.length} roles to process`);

    // 3. Bulk load data
    console.log('Loading role and profile data...');
    const dataStartTime = Date.now();
    const [roleData, profileData] = await Promise.all([
      getRolesData(supabase, roleIds),
      getProfileData(supabase, profileId)
    ]);
    debug.timings.loadData = Date.now() - dataStartTime;
    debug.counts.rolesLoaded = Object.keys(roleData).length;
    debug.counts.profileSkills = profileData.skills.length;
    debug.counts.profileCapabilities = profileData.capabilities.length;

    // 4. Get semantic matches
    console.log('Getting semantic matches...');
    const semanticStartTime = Date.now();
    const roleMatches = await getSemanticMatches(
      supabase,
      { id: profileId, table: 'profiles' },
      'roles',
      roleIds.length,
      options.threshold
    );
    debug.timings.semanticMatching = Date.now() - semanticStartTime;
    debug.counts.semanticMatches = roleMatches.length;

    // 5. Process matches
    console.log('Processing matches...');
    const matches: JobMatch[] = [];
    const processStartTime = Date.now();

    for (const job of openJobs.data) {
      if (!job.roleId || !roleData[job.roleId]) {
        debug.errors.push({ 
          step: 'processing', 
          error: `Missing role data for job ${job.jobId}` 
        });
        continue;
      }

      // Find semantic match
      const semanticMatch = roleMatches.find(m => m.id === job.roleId);
      if (!semanticMatch) {
        debug.errors.push({ 
          step: 'processing', 
          error: `No semantic match for role ${job.roleId}` 
        });
        continue;
      }

      // Calculate readiness
      const readinessScore = calculateJobReadiness(profileData, roleData[job.roleId]);
      const summary = generateJobSummary(profileData, roleData[job.roleId]);

      matches.push({
        jobId: job.jobId,
        jobTitle: job.title,
        roleId: job.roleId,
        score: readinessScore,
        semanticScore: semanticMatch.similarity,
        summary
      });
    }
    debug.timings.processing = Date.now() - processStartTime;
    debug.counts.finalMatches = matches.length;

    // 6. Sort by combined score
    console.log('Sorting results...');
    matches.sort((a, b) => {
      const scoreA = (a.score * 0.4) + (a.semanticScore * 0.6);
      const scoreB = (b.score * 0.4) + (b.semanticScore * 0.6);
      return scoreB - scoreA;
    });

    debug.timings.total = Date.now() - startTime;
    console.log('Job matching completed:', debug);

    return { 
      matches: matches.slice(0, 5), // Return top 5 matches
      debug 
    };

  } catch (error) {
    console.error('Error in job matching test:', error);
    debug.errors.push({ step: 'general', error });
    debug.timings.total = Date.now() - startTime;
    return { matches: [], debug };
  }
} 