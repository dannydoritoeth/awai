import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { getProfileData } from './getProfileData.ts';
import { getSemanticMatches } from '../embeddings.ts';

export interface ProfileMatch {
  profileId: string;
  name: string;
  semanticScore: number;
  summary: string;
  details?: {
    currentRole?: string;
    department?: string;
    capabilities?: {
      name: string;
      level: number;
    }[];
    capabilityMatchScore?: number;
    skills?: string[];
  };
}

export interface ProfileMatchingOptions {
  limit?: number;
  threshold?: number;
  includeDetails?: boolean;
}

const DEFAULT_OPTIONS: ProfileMatchingOptions = {
  limit: 20,
  threshold: 0.7,
  includeDetails: true
};

export async function getProfilesMatching(
  supabase: SupabaseClient<Database>,
  roleId: string,
  options: ProfileMatchingOptions = DEFAULT_OPTIONS
): Promise<{ matches: ProfileMatch[], debug?: any }> {
  const debug: any = {
    timings: {},
    counts: {},
    errors: []
  };
  const startTime = Date.now();

  try {
    console.log('Starting profile matching...', { roleId, options });
    
    // 1. Get semantic matches for profiles
    const semanticStartTime = Date.now();
    const profileMatches = await getSemanticMatches(
      supabase,
      { id: roleId, table: 'roles' },
      'profiles',
      options.limit,
      options.threshold
    );
    debug.timings.semanticMatching = Date.now() - semanticStartTime;
    debug.counts.semanticMatches = profileMatches.length;

    if (profileMatches.length === 0) {
      console.log('No semantic profile matches found');
      return { matches: [], debug };
    }

    // 2. Get profile data for matched profiles if details are requested
    const matches: ProfileMatch[] = [];
    
    if (options.includeDetails) {
      console.log('Loading profile data...');
      const dataStartTime = Date.now();
      const profileIds = profileMatches.map(m => m.id);
      
      // Load basic profile data and capabilities/skills in parallel
      const [profilesResult, profileDataResults] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, role_title, division')
          .in('id', profileIds),
        Promise.all(profileIds.map(id => getProfileData(supabase, id)))
      ]);

      if (profilesResult.error) {
        throw profilesResult.error;
      }

      // Create lookup maps
      const profilesMap = new Map(profilesResult.data?.map(p => [p.id, p]));
      const profileDataMap = profileDataResults.reduce((acc, curr, idx) => {
        if (curr) {
          acc[profileIds[idx]] = curr;
        }
        return acc;
      }, {} as Record<string, any>);
      
      debug.timings.loadData = Date.now() - dataStartTime;

      // Get role capabilities for matching
      const roleCapabilitiesResult = await supabase
        .from('role_capabilities')
        .select('capability_id, level, capabilities(name)')
        .eq('role_id', roleId);

      const roleCapabilities = roleCapabilitiesResult.data || [];
      
      // Process matches with full details
      for (const profileMatch of profileMatches) {
        const basicData = profilesMap.get(profileMatch.id);
        const profileData = profileDataMap[profileMatch.id];
        
        if (basicData && profileData) {
          // Calculate capability match score
          let capabilityMatchScore = 0;
          if (roleCapabilities.length > 0 && profileData.capabilities.length > 0) {
            const matchedCapabilities = profileData.capabilities.filter(pc => 
              roleCapabilities.some(rc => 
                rc.capability_id === pc.id && rc.level <= pc.level
              )
            );
            capabilityMatchScore = matchedCapabilities.length / roleCapabilities.length;
          }

          matches.push({
            profileId: profileMatch.id,
            name: basicData.name,
            semanticScore: profileMatch.similarity,
            summary: `Match score: ${(profileMatch.similarity * 100).toFixed(1)}% semantic, ${(capabilityMatchScore * 100).toFixed(1)}% capabilities`,
            details: {
              currentRole: basicData.role_title,
              department: basicData.division,
              capabilities: profileData.capabilities.map(c => ({
                name: c.name,
                level: c.level
              })),
              capabilityMatchScore,
              skills: profileData.skills?.map(s => s.name)
            }
          });
        }
      }
    } else {
      // Process matches with basic information only
      matches.push(...profileMatches.map(match => ({
        profileId: match.id,
        name: match.name || 'Unknown Profile',
        semanticScore: match.similarity,
        summary: `Semantic match score: ${(match.similarity * 100).toFixed(1)}%`
      })));
    }

    // Sort by combined score (semantic + capability if available)
    matches.sort((a, b) => {
      const aScore = a.semanticScore + (a.details?.capabilityMatchScore || 0);
      const bScore = b.semanticScore + (b.details?.capabilityMatchScore || 0);
      return bScore - aScore;
    });

    debug.timings.total = Date.now() - startTime;
    debug.matches = matches;
    console.log('Profile matching completed:', {
      matchCount: matches.length,
      timeMs: debug.timings.total
    });

    return { 
      matches: matches.slice(0, options.limit),
      debug 
    };

  } catch (error) {
    console.error('Error in profile matching:', error);
    debug.errors.push({ step: 'general', error });
    debug.timings.total = Date.now() - startTime;
    return { matches: [], debug };
  }
} 