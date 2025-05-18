import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { getOpenJobs } from './getOpenJobs.ts';
import { getProfileData } from '../profile/getProfileData.ts';
import { getRolesData } from '../role/getRoleData.ts';
import { calculateJobReadiness, generateJobSummary } from './jobReadiness.ts';
import { getSemanticMatches } from '../embeddings.ts';

export interface JobMatch {
  roleId: string;
  jobId?: string;
  jobTitle: string;
  score: number;
  semanticScore: number;
  summary: string;
  details?: {
    department?: string;
    location?: string;
    skills?: string[];
    matchedSkills?: string[];
  };
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
    
    // 1. Get semantic matches for roles
    console.log('Getting semantic matches...');
    const semanticStartTime = Date.now();
    const roleMatches = await getSemanticMatches(
      supabase,
      { id: profileId, table: 'profiles' },
      'roles',
      options.limit,
      options.threshold
    );
    debug.timings.semanticMatching = Date.now() - semanticStartTime;
    debug.counts.semanticMatches = roleMatches.length;

    if (roleMatches.length === 0) {
      console.log('No semantic role matches found');
      return { matches: [], debug };
    }

    // 2. Get role data for matched roles
    console.log('Loading role and profile data...');
    const dataStartTime = Date.now();
    const roleIds = roleMatches.map(m => m.id);
    console.log('Role IDs:', roleIds);
    const [roleData, profileData] = await Promise.all([
      getRolesData(supabase, roleIds),
      getProfileData(supabase, profileId)
    ]);
    console.log('Role data:', roleData);
    debug.timings.loadData = Date.now() - dataStartTime;
    debug.counts.rolesLoaded = Object.keys(roleData).length;
    debug.counts.profileSkills = profileData.skills.length;
    debug.counts.profileCapabilities = profileData.capabilities.length;

    // 3. Get open jobs (optional)
    console.log('Fetching open jobs...');
    const openJobs = await getOpenJobs(supabase, undefined, options.limit);
    debug.timings.getJobs = Date.now() - startTime;
    debug.counts.totalJobs = openJobs.data?.length || 0;
    
    // Create a map of roleId to job for quick lookup
    const jobsByRole = new Map(
      openJobs.data?.map(job => [job.roleId, job]) || []
    );

    // 4. Process matches
    console.log('Processing matches...');
    const matches: JobMatch[] = [];
    const processStartTime = Date.now();

    for (const roleMatch of roleMatches) {
      const currentRoleData = roleData[roleMatch.id];
      const job = jobsByRole.get(roleMatch.id);
      
      // Calculate readiness if we have role data, otherwise just use semantic score
      let readinessScore = 0;
      let summary = '';
      
      if (currentRoleData) {
        readinessScore = calculateJobReadiness(profileData, currentRoleData);
        summary = generateJobSummary(profileData, currentRoleData);
      } else {
        readinessScore = roleMatch.similarity * 100;
        summary = `Semantic match score: ${(roleMatch.similarity * 100).toFixed(1)}%`;
      }

      matches.push({
        roleId: roleMatch.id,
        jobId: job?.jobId,
        jobTitle: job?.title || currentRoleData?.title || 'Unknown Role',
        score: readinessScore,
        semanticScore: roleMatch.similarity,
        summary,
        details: currentRoleData ? {
          department: currentRoleData.department,
          location: currentRoleData.location,
          skills: currentRoleData.skills?.map(s => s.name),
          matchedSkills: profileData.skills
            .filter(ps => currentRoleData.skills?.some(rs => 
              rs.name.toLowerCase() === ps.name.toLowerCase() ||
              rs.name.toLowerCase().includes(ps.name.toLowerCase()) ||
              ps.name.toLowerCase().includes(rs.name.toLowerCase())
            ))
            .map(s => s.name)
        } : undefined
      });
    }
    debug.timings.processing = Date.now() - processStartTime;
    debug.counts.finalMatches = matches.length;

    // 5. Sort by combined score
    console.log('Sorting results...');
    matches.sort((a, b) => {
      const scoreA = (a.score * 0.4) + (a.semanticScore * 0.6);
      const scoreB = (b.score * 0.4) + (b.semanticScore * 0.6);
      return scoreB - scoreA;
    });

    debug.timings.total = Date.now() - startTime;
    debug.matches = matches;
    console.log('Job matching completed:', debug);

    return { 
      matches: matches.slice(0, options.limit),
      debug 
    };

  } catch (error) {
    console.error('Error in job matching test:', error);
    debug.errors.push({ step: 'general', error });
    debug.timings.total = Date.now() - startTime;
    return { matches: [], debug };
  }
} 