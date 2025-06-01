import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { getRolesData } from './getRoleData.ts';
import { getProfileData } from '../profile/getProfileData.ts';
import { getSemanticMatches } from '../embeddings.ts';

export interface RoleMatch {
  roleId: string;
  title: string;
  semanticScore: number;
  summary: string;
  details?: {
    department?: string;
    location?: string;
    skills?: string[];
    matchedSkills?: string[];
  };
}

export interface RoleMatchingOptions {
  limit?: number;
  threshold?: number;
  includeDetails?: boolean;
}

const DEFAULT_OPTIONS: RoleMatchingOptions = {
  limit: 20,
  threshold: 0.7,
  includeDetails: true
};

export async function getRolesMatching(
  supabase: SupabaseClient<Database>,
  profileId: string,
  options: RoleMatchingOptions = DEFAULT_OPTIONS
): Promise<{ matches: RoleMatch[], debug?: any }> {
  const debug: any = {
    timings: {},
    counts: {},
    errors: []
  };
  const startTime = Date.now();

  try {
    console.log('Starting role matching...', { profileId, options });
    
    // 1. Get semantic matches for roles
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

    // 2. Get role data for matched roles if details are requested
    const matches: RoleMatch[] = [];
    
    if (options.includeDetails) {
      console.log('Loading role and profile data...');
      const dataStartTime = Date.now();
      const roleIds = roleMatches.map(m => m.id);
      const [roleData, profileData] = await Promise.all([
        getRolesData(supabase, roleIds),
        getProfileData(supabase, profileId)
      ]);
      debug.timings.loadData = Date.now() - dataStartTime;

      // Process matches with full details
      for (const roleMatch of roleMatches) {
        const currentRoleData = roleData[roleMatch.id];
        
        matches.push({
          roleId: roleMatch.id,
          title: currentRoleData?.title || 'Unknown Role',
          semanticScore: roleMatch.similarity,
          summary: currentRoleData?.description || `Semantic match score: ${(roleMatch.similarity * 100).toFixed(1)}%`,
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
    } else {
      // Process matches with basic information only
      matches.push(...roleMatches.map(match => ({
        roleId: match.id,
        title: match.name || 'Unknown Role',
        semanticScore: match.similarity,
        summary: `Semantic match score: ${(match.similarity * 100).toFixed(1)}%`
      })));
    }

    // Sort by semantic score
    matches.sort((a, b) => b.semanticScore - a.semanticScore);

    debug.timings.total = Date.now() - startTime;
    debug.matches = matches;
    console.log('Role matching completed:', {
      matchCount: matches.length,
      timeMs: debug.timings.total
    });

    return { 
      matches: matches.slice(0, options.limit),
      debug 
    };

  } catch (error) {
    console.error('Error in role matching:', error);
    debug.errors.push({ step: 'general', error });
    debug.timings.total = Date.now() - startTime;
    return { matches: [], debug };
  }
}
