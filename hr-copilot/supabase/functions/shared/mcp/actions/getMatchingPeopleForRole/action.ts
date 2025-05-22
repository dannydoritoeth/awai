/**
 * @fileoverview Finds and analyzes matching candidates for a given role
 * 
 * Purpose: Identifies and evaluates potential candidates for a role based on skills,
 * capabilities, and semantic matching.
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
import { MCPRequest, MCPResponse, MCPActionV2 } from '../../types/action.ts';
import { getRoleDetail } from '../../../role/getRoleDetail.ts';
import { logAgentProgress } from '../../../chatUtils.ts';
import { ActionButtons } from '../../../utils/markdown/renderMarkdownActionButton.ts';
import { getProfilesMatching, ProfileMatch } from '../../../profile/getProfilesMatching.ts';

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

    // Find matching profiles
    const profileMatchingResult = await getProfilesMatching(supabase, roleId);
    const matches = profileMatchingResult.matches || [];

    // Format the message for both chat and response
    let message = '';
    if (matches.length > 0) {
      const truncateSummary = (summary: string) => {
        const firstSentence = summary.split('.')[0];
        return firstSentence.length > 100 ? `${firstSentence.substring(0, 97)}...` : firstSentence;
      };

      message = `### 👥 Top Matching Candidates for ${roleData.title}

${matches.slice(0, 5).map((match, index) => {
  const score = (match.semanticScore * 100).toFixed(0);
  const skills = match.details?.matchedSkills?.length || 0;
  const currentRole = match.details?.currentRole;
  
  return `**${index + 1}. ${match.name}** (${score}% match)
   ${currentRole ? `💼 ${currentRole}` : ''}
   
${ActionButtons.roleExplorationGroup(match.profileId, roleId, match.name)}`;
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
        { phase: matches.length > 0 ? 'matches_found' : 'no_matches' }
      );
    }

    return {
      success: true,
      message: `Found ${matches.length} matching candidates`,
      chatResponse: {
        message,
        followUpQuestion: 'Would you like to explore any of these candidates in more detail?',
        aiPrompt: 'The user may want to explore candidate profiles or analyze skill gaps.',
        promptDetails: {
          matchCount: matches.length,
          hasMatches: matches.length > 0
        }
      },
      dataForDownstreamPrompt: {
        getMatchingPeopleForRole: {
          dataSummary: message,
          structured: {
            roleId,
            roleTitle: roleData.title,
            matchCount: matches.length,
            topMatches: matches.slice(0, 5).map(match => ({
              profileId: match.profileId,
              name: match.name,
              score: match.semanticScore,
              skills: match.details?.skills || []
            }))
          },
          truncated: false
        }
      },
      data: {
        matches: matches.slice(0, 10),
        recommendations: matches.slice(0, 5),
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