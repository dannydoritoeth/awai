/**
 * @fileoverview Finds and analyzes matching candidates for a given role
 * 
 * Purpose: Identifies and evaluates potential candidates for a role based on skills,
 * capabilities, and semantic matching. Provides detailed analysis of each match.
 * 
 * Inputs:
 * - roleId: ID of the role to find matches for
 * 
 * Outputs:
 * - Prioritized list of matching candidates with fit analysis
 * - AI-generated explanation of matches
 * - Recommended next actions
 * 
 * Related Actions:
 * - getCapabilityGaps: Used to analyze candidate fit
 * - getSkillGaps: Used to assess technical fit
 * - getRoleDetails: Used to understand role requirements
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../../database.types.ts';
import { MCPRequest, MCPResponse, SemanticMatch } from '../../types/action.ts';
import { getSemanticMatches } from '../../../embeddings.ts';
import { getCapabilityGaps } from '../../../profile/getCapabilityGaps.ts';
import { getSkillGaps } from '../../../profile/getSkillGaps.ts';
import { batchScoreProfileFit } from '../../../agent/scoreProfileFit.ts';
import { getRoleDetail } from '../../../role/getRoleDetail.ts';
import { getProfileData } from '../../../profile/getProfileData.ts';
import { logAgentProgress } from '../../../chatUtils.ts';
import { ActionButtons } from '../../../utils/markdown/renderMarkdownActionButton.ts';

interface ProcessedMatch {
  profileId: string;
  name: string;
  score: number;
  semanticScore: number;
  details: {
    capabilities: {
      matched: string[];
      missing: string[];
      insufficient: string[];
    };
    skills: {
      matched: string[];
      missing: string[];
      insufficient: string[];
    };
  };
  summary?: string;
}

async function getMatchingPeopleForRoleBase(request: MCPRequest): Promise<MCPResponse> {
  const supabase = request.supabase as SupabaseClient<Database>;
  const { roleId, sessionId } = request;

  try {
    // Input validation
    if (!roleId) {
      throw new Error('roleId is required');
    }

    // Log starting analysis
    if (sessionId) {
      await logAgentProgress(
        supabase,
        sessionId,
        "I'm analyzing the role requirements and finding the best candidate matches...",
        { phase: 'analysis_start' }
      );
    }

    // Get role details
    const roleDetailResponse = await getRoleDetail(supabase, roleId);
    if (!roleDetailResponse.data) {
      throw new Error('Could not load role details');
    }
    const roleData = roleDetailResponse.data;

    // Get semantic matches
    const profileMatches = await getSemanticMatches(
      supabase,
      { id: roleId, table: 'roles' },
      'profiles',
      20,
      0.5
    );

    // Log matches found
    if (sessionId) {
      await logAgentProgress(
        supabase,
        sessionId,
        `Found ${profileMatches.length} potential matches. Analyzing qualifications...`,
        { phase: 'matches_found' }
      );
    }

    // Process matches in detail
    const processedMatches: ProcessedMatch[] = [];
    const profileIds = profileMatches.map(match => match.id);

    // Score all profiles in batch
    const scoreResults = await batchScoreProfileFit(supabase, roleId, profileIds, {
      maxRoles: 20,
      maxConcurrent: 5
    });

    // Process each match with detailed analysis
    for (const profileId of profileIds) {
      const semanticMatch = profileMatches.find(m => m.id === profileId);
      const scoreResult = scoreResults.find(r => r.roleId === profileId);
      
      if (!semanticMatch || !scoreResult?.result.data) continue;

      // Get profile data
      const profileData = await getProfileData(supabase, profileId);
      if (!profileData) continue;

      // Get capability and skill gaps
      const [capabilityGaps, skillGaps] = await Promise.all([
        getCapabilityGaps(supabase, profileId, roleId),
        getSkillGaps(supabase, profileId, roleId)
      ]);

      processedMatches.push({
        profileId,
        name: profileData.name,
        score: scoreResult.result.data.score,
        semanticScore: semanticMatch.similarity,
        details: {
          capabilities: {
            matched: capabilityGaps.data?.filter(gap => gap.gapType === 'met').map(gap => gap.name) || [],
            missing: capabilityGaps.data?.filter(gap => gap.gapType === 'missing').map(gap => gap.name) || [],
            insufficient: capabilityGaps.data?.filter(gap => gap.gapType === 'insufficient').map(gap => gap.name) || []
          },
          skills: {
            matched: skillGaps.data?.filter(gap => gap.gapType === 'met').map(gap => gap.name) || [],
            missing: skillGaps.data?.filter(gap => gap.gapType === 'missing').map(gap => gap.name) || [],
            insufficient: skillGaps.data?.filter(gap => gap.gapType === 'insufficient').map(gap => gap.name) || []
          }
        },
        summary: semanticMatch.summary
      });
    }

    // Sort matches by combined score
    processedMatches.sort((a, b) => {
      const scoreA = (a.score * 0.4) + (a.semanticScore * 0.6);
      const scoreB = (b.score * 0.4) + (b.semanticScore * 0.6);
      return scoreB - scoreA;
    });

    // Format message for chat and response
    let message = '';
    if (processedMatches.length > 0) {
      message = `### 👥 Top Matching Candidates for ${roleData.title}

${processedMatches.slice(0, 5).map((match, index) => {
  const score = ((match.score * 0.4 + match.semanticScore * 0.6) * 100).toFixed(0);
  const capabilityMatch = match.details.capabilities.matched.length;
  const skillMatch = match.details.skills.matched.length;
  
  return `**${index + 1}. ${match.name}** (${score}% match)
   🎯 Matches ${capabilityMatch} capabilities and ${skillMatch} skills
   ${match.summary || 'No summary available'}
${ActionButtons.profileExplorationGroup(match.profileId, roleId, match.name)}`;
}).join('\n\n')}

Select an action above to learn more about any candidate.`;
    } else {
      message = "I couldn't find any matching candidates at this time. Consider adjusting the role requirements or broadening the search criteria.";
    }

    // Log final message to chat
    if (sessionId) {
      await logAgentProgress(
        supabase,
        sessionId,
        message,
        { phase: 'analysis_complete' }
      );
    }

    return {
      success: true,
      message: `Found ${processedMatches.length} matching candidates`,
      chatResponse: {
        message,
        followUpQuestion: 'Would you like to explore any of these candidates in more detail?',
        aiPrompt: 'The user may want to explore candidate profiles or analyze skill gaps.',
        promptDetails: {
          matchCount: processedMatches.length,
          hasMatches: processedMatches.length > 0
        }
      },
      dataForDownstreamPrompt: {
        getMatchingPeopleForRole: {
          dataSummary: message,
          structured: {
            roleId,
            roleTitle: roleData.title,
            matchCount: processedMatches.length,
            topMatches: processedMatches.slice(0, 5).map(match => ({
              profileId: match.profileId,
              name: match.name,
              score: match.score,
              semanticScore: match.semanticScore,
              capabilityMatches: match.details.capabilities.matched.length,
              skillMatches: match.details.skills.matched.length
            }))
          },
          truncated: false
        }
      },
      data: {
        matches: processedMatches.slice(0, 10),
        recommendations: processedMatches.slice(0, 5),
        nextActions: [
          {
            type: 'review_candidates',
            description: 'Review candidate profiles',
            priority: 1
          },
          {
            type: 'analyze_gaps',
            description: 'Analyze skill and capability gaps',
            priority: 1
          },
          {
            type: 'schedule_interviews',
            description: 'Schedule candidate interviews',
            priority: 2
          }
        ],
        actionsTaken: [
          {
            tool: 'getRoleDetail',
            reason: 'Retrieved role requirements',
            result: 'success',
            confidence: 1.0,
            inputs: { roleId },
            timestamp: new Date().toISOString()
          },
          {
            tool: 'findMatches',
            reason: 'Found and analyzed candidate matches',
            result: 'success',
            confidence: 0.9,
            inputs: { roleId },
            timestamp: new Date().toISOString()
          }
        ],
        role: roleData
      }
    };

  } catch (error) {
    console.error('Error in getMatchingPeopleForRole:', error);
    
    const errorMessage = "I encountered an error while finding matching candidates. Let me know if you'd like to try again.";
    
    if (sessionId) {
      await logAgentProgress(
        supabase,
        sessionId,
        errorMessage,
        { phase: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      chatResponse: {
        message: errorMessage,
        followUpQuestion: 'Would you like me to try searching again?',
        aiPrompt: 'The user may want to retry or adjust search criteria.',
        promptDetails: {
          hadError: true,
          errorType: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      error: {
        type: 'MATCHING_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error
      }
    };
  }
}

// Create the MCPActionV2 implementation
export const getMatchingPeopleForRole: MCPActionV2 = {
  id: 'getMatchingPeopleForRole',
  title: 'Get Matching People for Role',
  description: 'Find and analyze matching candidates for a given role',
  applicableRoles: ['hiring_manager', 'recruiter'],
  capabilityTags: ['Hiring', 'Candidate Matching', 'Talent Analysis'],
  requiredInputs: ['roleId'],
  tags: ['hiring', 'matching', 'tactical'],
  recommendedAfter: ['getRoleDetails'],
  recommendedBefore: ['getCapabilityGaps', 'getSkillGaps'],
  usesAI: false,
  actionFn: (ctx: Record<string, any>) => getMatchingPeopleForRoleBase(ctx as MCPRequest),
  getDefaultArgs: (context: Record<string, any>) => ({
    roleId: context.roleId
  })
};

export default getMatchingPeopleForRole; 