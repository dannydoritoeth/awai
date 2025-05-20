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
import { logAgentAction } from '../../../agent/logAgentAction.ts';
import { logAgentResponse } from '../../../chatUtils.ts';
import { MCPActionV2 } from '../../types/action.ts';
import { getRolesMatching } from '../../../role/getRolesMatching.ts';
import { ActionButtons } from '../../../utils/markdown/renderMarkdownActionButton.ts';

async function getMatchingRolesForPersonBase(request: MCPRequest): Promise<MCPResponse> {
  const supabase = request.supabase as SupabaseClient<Database>;
  const { profileId, context, sessionId } = request;

  // Enhanced logging for debugging
  console.log('Starting getMatchingRolesForPerson with:', {
    hasProfileId: !!profileId,
    hasContext: !!context,
    contextKeys: context ? Object.keys(context) : [],
    sessionId
  });

  try {
    // Validate inputs with detailed error messages
    if (!profileId) {
      const error = {
        type: 'INVALID_INPUT',
        message: 'ProfileId is required',
        details: { providedContext: context }
      };
      console.error('Validation failed:', error);
      return {
        success: false,
        message: 'Invalid input: profileId is required',
        error
      };
    }

    // Phase 1: Load profile data with enhanced error handling
    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        "Loading your profile data to find matching roles...",
        'data_loading'
      );
    }

    let profileContext: ProfileContext | null = null;
    let profileData = null;

    try {
      [profileContext, profileData] = await Promise.all([
        getProfileContext(supabase, profileId).then(result => {
          if (result.error) {
            console.error('Error loading profile context:', result.error);
            throw result.error;
          }
          return result.data;
        }),
        getProfileData(supabase, profileId)
      ]);

      console.log('Profile data loaded:', {
        hasProfileContext: !!profileContext,
        hasProfileData: !!profileData,
        skillsCount: profileData?.skills?.length,
        capabilitiesCount: profileData?.capabilities?.length
      });

    } catch (loadError) {
      console.error('Failed to load profile data:', loadError);
      return {
        success: false,
        message: 'Could not load profile data',
        error: {
          type: 'DATA_LOADING_ERROR',
          message: 'Failed to load profile data',
          details: loadError
        }
      };
    }

    if (!profileContext || !profileData) {
      return {
        success: false,
        message: 'Could not fetch profile data',
        error: {
          type: 'DATA_NOT_FOUND',
          message: 'Profile data not found',
          details: { profileId }
        }
      };
    }

    // Phase 2: Find matching roles with enhanced logging
    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        "Searching for roles that match your profile...",
        'finding_matches'
      );
    }

    const matches: SemanticMatch[] = [];
    const recommendations: any[] = [];

    try {
      const roleMatchingResult = await getRolesMatching(supabase, profileId, {
        limit: 20,
        threshold: 0.7,
        includeDetails: true
      });

      console.log('Role matching completed:', {
        matchCount: roleMatchingResult.matches.length,
        threshold: 0.7
      });

      // Phase 3: Process matches
      if (sessionId) {
        await logAgentResponse(
          supabase,
          sessionId,
          `Found ${roleMatchingResult.matches.length} potential matches. Processing results...`,
          'processing_matches'
        );
      }

      if (roleMatchingResult.matches.length > 0) {
        matches.push(...roleMatchingResult.matches.map(match => ({
          id: match.roleId,
          name: match.title,
          similarity: match.semanticScore,
          type: 'role' as const,
          summary: match.summary
        })));

        recommendations.push(...roleMatchingResult.matches.map(match => ({
          type: 'role_match',
          score: match.semanticScore,
          semanticScore: match.semanticScore,
          summary: match.summary,
          details: {
            roleId: match.roleId,
            title: match.title,
            department: match.details?.department,
            location: match.details?.location,
            matchedSkills: match.details?.matchedSkills
          }
        })));

        // Format matches as markdown and log to chat
        if (sessionId) {
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

          await logAgentResponse(
            supabase,
            sessionId,
            matchesMarkdown,
            'matches_found'
          );
        }
      }

    } catch (matchError) {
      console.error('Error during role matching:', matchError);
      return {
        success: false,
        message: 'Failed to find matching roles',
        error: {
          type: 'MATCHING_ERROR',
          message: 'Error during role matching process',
          details: matchError
        }
      };
    }

    // Log completion and results
    await logAgentAction(supabase, {
      entityType: 'profile',
      entityId: profileId,
      payload: {
        action: 'role_matching_complete',
        matchSummary: {
          totalMatches: matches.length,
          highQualityMatches: matches.filter(m => m.similarity > 0.8).length,
          averageSimilarity: matches.length > 0 
            ? matches.reduce((acc, m) => acc + m.similarity, 0) / matches.length 
            : 0
        }
      },
      semanticMetrics: {
        similarityScores: {
          roleMatch: matches.length > 0 ? matches[0].similarity : 0,
          skillAlignment: matches.length > 0 ? matches[0].similarity : 0,
          capabilityAlignment: matches.length > 0 ? matches[0].similarity : 0
        },
        matchingStrategy: 'semantic',
        confidenceScore: 0.9
      }
    });

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
      await logAgentResponse(
        supabase,
        sessionId,
        "I encountered an error while finding matching roles. Let me know if you'd like to try again.",
        'matching_error'
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