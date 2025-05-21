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
import { MCPRequest, MCPResponse, SemanticMatch, NextAction, MCPAction, ProfileContext } from '../../../mcpTypes.ts';
import { getProfileContext } from '../../../profile/getProfileContext.ts';
import { getProfileData } from '../../../profile/getProfileData.ts';
import { testJobMatching } from '../../../job/testJobMatching.ts';
import { logAgentProgress } from '../../../chatUtils.ts';
import { MCPActionV2 } from '../../types/action.ts';
import { getRolesMatching } from '../../../role/getRolesMatching.ts';
import { ActionButtons } from '../../../utils/markdown/renderMarkdownActionButton.ts';

async function getMatchingRolesForPersonBase(request: MCPRequest): Promise<MCPResponse> {
  const supabase = request.supabase as SupabaseClient<Database>;
  const { profileId, sessionId } = request;

  try {
    // Load profile context
    const profileContext = await getProfileContext(supabase, profileId);
    if (!profileContext) {
      throw new Error('Could not load profile context');
    }

    // Find matching roles
    const roleMatchingResult = await getRolesMatching(supabase, profileId);
    if (!roleMatchingResult.success) {
      throw new Error('Failed to find matching roles');
    }

    const matches = roleMatchingResult.matches || [];
    const recommendations = roleMatchingResult.recommendations || [];

    // Only log if we found matches
    if (sessionId && matches.length > 0) {
      const truncateSummary = (summary: string) => {
        const firstSentence = summary.split('.')[0];
        return firstSentence.length > 100 ? `${firstSentence.substring(0, 97)}...` : firstSentence;
      };

      const matchesMarkdown = `### 🎯 Top Matching Roles

${roleMatchingResult.matches.slice(0, 5).map((match, index) => `**${index + 1}. ${match.title}** (${(match.semanticScore * 100).toFixed(0)}% match)
   ${truncateSummary(match.summary)}
   ${match.details?.department ? `📍 ${match.details.department}` : ''}
${ActionButtons.roleExplorationGroup(profileId, match.roleId, match.title)}`).join('\n\n')}

Select an action above to learn more about any role.`;

      await logAgentProgress(
        supabase,
        sessionId,
        matchesMarkdown,
        { phase: 'matches_found' }
      );
    }

    return {
      success: true,
      message: `Found ${matches.length} matching roles`,
      data: {
        matches: matches.slice(0, 10),
        recommendations: recommendations.slice(0, 5),
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
    
    if (sessionId) {
      await logAgentProgress(
        supabase,
        sessionId,
        "I encountered an error while finding matching roles. Let me know if you'd like to try again.",
        { phase: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
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
  recommendedAfter: [],
  recommendedBefore: ['getCapabilityGaps', 'getDevelopmentPlan'],
  usesAI: false,
  actionFn: (ctx: Record<string, any>) => getMatchingRolesForPersonBase(ctx as MCPRequest),
  getDefaultArgs: (context: Record<string, any>) => ({
    profileId: context.profileId
  })
}; 