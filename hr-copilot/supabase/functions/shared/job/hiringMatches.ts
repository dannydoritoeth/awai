import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { getSemanticMatches } from '../embeddings.ts';
import { batchScoreRoleProfiles } from '../agent/scoreProfileFit.ts';

export interface HiringMatch {
  profileId: string;
  name: string;
  score: number;
  semanticScore: number;
  summary?: string;
  details?: {
    capabilities?: string[];
    skills?: string[];
    missingCapabilities?: string[];
    missingSkills?: string[];
  };
}

export interface HiringMatchesOptions {
  limit?: number;
  threshold?: number;
  maxConcurrent?: number;
}

interface DebugInfo {
  timings: {
    semanticMatching?: number;
    scoring?: number;
    total?: number;
  };
  counts: {
    semanticMatches?: number;
    finalMatches?: number;
  };
  errors: Error[];
}

export async function getHiringMatches(
  supabase: SupabaseClient<Database>,
  roleId: string,
  options: HiringMatchesOptions = {}
): Promise<{
  matches: HiringMatch[];
  debug: DebugInfo;
}> {
  const startTime = Date.now();
  const debug: DebugInfo = {
    timings: {},
    counts: {},
    errors: []
  };

  try {
    // Get semantic matches for profiles from the role
    const semanticStartTime = Date.now();
    const profileMatches = await getSemanticMatches(
      supabase,
      { id: roleId, table: 'roles' },
      'profiles',
      options.limit || 20,
      options.threshold || 0.3
    );
    debug.timings.semanticMatching = Date.now() - semanticStartTime;
    debug.counts.semanticMatches = profileMatches.length;

    if (profileMatches.length === 0) {
      return { matches: [], debug };
    }

    // Get profile IDs for batch scoring
    const profileIds = profileMatches.map(match => match.id);

    // Score profiles against role using the new function
    const scoringStartTime = Date.now();
    const scoreResults = await batchScoreRoleProfiles(
      supabase,
      roleId,
      profileIds,
      {
        maxProfiles: options.limit || 20,
        maxConcurrent: options.maxConcurrent || 5
      }
    );
    debug.timings.scoring = Date.now() - scoringStartTime;

    // Combine semantic and score results
    const matches: HiringMatch[] = scoreResults
      .filter(result => result.result.data) // Filter out failed scores
      .map(result => {
        const semanticMatch = profileMatches.find(m => m.id === result.roleId);
        const scoreData = result.result.data;

        return {
          profileId: result.roleId, // roleId field contains profileId in this case
          name: semanticMatch?.name || 'Unknown Profile',
          score: scoreData?.score || 0,
          semanticScore: semanticMatch?.similarity || 0,
          summary: scoreData?.matchSummary,
          details: {
            capabilities: scoreData?.missingCapabilities || [],
            skills: scoreData?.missingSkills || []
          }
        };
      })
      .sort((a, b) => b.score - a.score);

    debug.timings.total = Date.now() - startTime;
    debug.counts.finalMatches = matches.length;

    return {
      matches,
      debug
    };

  } catch (error) {
    console.error('Error in getHiringMatches:', error);
    debug.errors.push(error);
    return {
      matches: [],
      debug
    };
  }
} 