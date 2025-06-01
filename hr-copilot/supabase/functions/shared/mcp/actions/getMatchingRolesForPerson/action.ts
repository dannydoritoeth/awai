/**
 * @fileoverview Finds and analyzes matching roles for a given profile
 * 
 * Related Actions:
 * - getCapabilityGaps: Used to analyze fit with potential roles
 * - getDevelopmentPlan: Can be used to create plan for target roles
 * - getSkillGaps: Used to assess technical fit with roles
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../../database.types.ts';
import { MCPRequest, SemanticMatch, NextAction, MCPAction, ProfileContext } from '../../../mcpTypes.ts';
import { getProfileContext } from '../../../profile/getProfileContext.ts';
import { getProfileData } from '../../../profile/getProfileData.ts';
import { testJobMatching } from '../../../job/testJobMatching.ts';
import { logAgentProgress } from '../../../chatUtils.ts';
import { MCPActionV2, MCPResponse } from '../../types/action.ts';
import { getRolesMatching, RoleMatch } from '../../../role/getRolesMatching.ts';
import { ActionButtons } from '../../../utils/markdown/renderMarkdownActionButton.ts';

async function getMatchingRolesForPersonBase(request: MCPRequest): Promise<MCPResponse> {
  const supabase = request.supabase as SupabaseClient<Database>;
  const { profileId, sessionId } = request;

  if (!profileId) {
    throw new Error('profileId is required');
  }

  try {
    // Load profile context
    const profileContextResult = await getProfileContext(supabase, profileId);
    if (!profileContextResult?.data) {
      throw new Error('Could not load profile context');
    }
    const profileContext = profileContextResult.data;

    // Find matching roles
    const roleMatchingResult = await getRolesMatching(supabase, profileId);
    const matches = roleMatchingResult.matches || [];

    // Format the message for both chat and response
    let message = '';
    if (matches.length > 0) {
      const truncateSummary = (summary: string) => {
        const firstSentence = summary.split('.')[0];
        return firstSentence.length > 100 ? `${firstSentence.substring(0, 97)}...` : firstSentence;
      };

      message = `### 🎯 Top Matching Roles

${matches.slice(0, 5).map((match, index) => {
  const title = match.title || 'Untitled Role';
  const score = match.semanticScore || 0;
  const summary = match.summary || 'No description available';
  const department = match.details?.department;
  const roleId = match.roleId;
  
  if (!roleId) {
    return `**${index + 1}. ${title}** (${(score * 100).toFixed(0)}% match)
   ${truncateSummary(summary)}
   ${department ? `📍 ${department}` : ''}`;
  }
  
  return `**${index + 1}. ${title}** (${(score * 100).toFixed(0)}% match)
   ${truncateSummary(summary)}
   ${department ? `📍 ${department}` : ''}
${ActionButtons.roleExplorationGroup(profileId, roleId, title)}`;
}).join('\n\n')}

Select an action above to learn more about any role.`;
    } else {
      message = "I couldn't find any matching roles at this time. Let's explore other career options or refine our search criteria.";
    }

    // Log the message in chat if we have a session
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
      message: `Found ${matches.length} matching roles`,
      chatResponse: {
        message,
        followUpQuestion: 'Would you like to explore any of these roles in more detail?',
        aiPrompt: 'The user may want to explore role details or analyze skill gaps.',
        promptDetails: {
          matchCount: matches.length,
          hasMatches: matches.length > 0
        }
      },
      dataForDownstreamPrompt: {
        getMatchingRolesForPerson: {
          dataSummary: message,
          structured: {
            matchCount: matches.length,
            topMatches: matches.slice(0, 5).map(match => ({
              title: match.title || 'Untitled Role',
              score: match.semanticScore || 0,
              department: match.details?.department,
              roleId: match.roleId
            }))
          },
          truncated: false
        }
      },
      data: {
        matches: matches.slice(0, 10),
        recommendations: matches.slice(0, 5), // Use top matches as recommendations
        nextActions: [
          {
            type: 'review_matches',
            description: 'Review suggested role matches',
            priority: 1
          },
          {
            type: 'explore_roles',
            description: 'Explore role details',
            priority: 1
          },
          {
            type: 'get_development_plan',
            description: 'Get a development plan for target roles',
            priority: 2
          }
        ],
        actionsTaken: [
          {
            tool: 'getProfileData',
            reason: 'Retrieved profile data',
            result: 'success',
            confidence: 1.0,
            inputs: { profileId },
            timestamp: new Date().toISOString()
          },
          {
            tool: 'findMatches',
            reason: 'Found and analyzed role matches',
            result: 'success',
            confidence: 0.9,
            inputs: { profileId },
            timestamp: new Date().toISOString()
          }
        ],
        profile: profileContext
      }
    };

  } catch (error) {
    console.error('Unhandled error in getMatchingRolesForPerson:', error);
    
    const errorMessage = "I encountered an error while finding matching roles. Let me know if you'd like to try again.";
    
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
        aiPrompt: 'The user may want to retry or try different criteria.',
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
export const getMatchingRolesForPerson: MCPActionV2 = {
  id: 'getMatchingRolesForPerson',
  title: 'Get Matching Roles for Person',
  description: 'Find and analyze matching roles for a given profile',
  applicableRoles: ['candidate'],
  capabilityTags: ['Career Development', 'Job Matching', 'Role Analysis'],
  requiredInputs: ['profileId'],
  tags: ['role_matching', 'tactical'],
  suggestedPrerequisites: [],
  suggestedPostrequisites: ['getCapabilityGaps', 'getDevelopmentPlan'],
  usesAI: false,
  actionFn: (ctx: Record<string, any>) => getMatchingRolesForPersonBase(ctx as MCPRequest),
  getDefaultArgs: (context: Record<string, any>) => ({
    profileId: context.profileId
  })
}; 