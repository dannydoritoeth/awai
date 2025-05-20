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

    // Phase 2: Find matching jobs with enhanced logging
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
      const jobMatchingResult = await testJobMatching(supabase, profileId, {
        limit: 20,
        threshold: 0.7
      });

      console.log('Job matching completed:', {
        matchCount: jobMatchingResult.matches.length,
        threshold: 0.7
      });

      // Phase 3: Process matches
      if (sessionId) {
        await logAgentResponse(
          supabase,
          sessionId,
          `Found ${jobMatchingResult.matches.length} potential matches. Processing results...`,
          'processing_matches'
        );
      }

      if (jobMatchingResult.matches.length > 0) {
        matches.push(...jobMatchingResult.matches.map(match => ({
          id: match.roleId,
          name: match.jobTitle,
          similarity: match.semanticScore,
          type: 'role' as const,
          summary: match.summary
        })));

        recommendations.push(...jobMatchingResult.matches.map(match => ({
          type: 'job_opportunity',
          score: match.score,
          semanticScore: match.semanticScore,
          summary: match.summary,
          details: {
            jobId: match.jobId,
            roleId: match.roleId,
            title: match.jobTitle
          }
        })));

        // Format matches as markdown and log to chat
        if (sessionId) {
          const truncateSummary = (summary: string) => {
            const firstSentence = summary.split('.')[0];
            return firstSentence.length > 100 ? `${firstSentence.substring(0, 97)}...` : firstSentence;
          };

          const matchesMarkdown = `### 🎯 Top Matching Roles

${jobMatchingResult.matches.slice(0, 5).map((match, index) => `${index + 1}. **${match.jobTitle}** (${(match.semanticScore * 100).toFixed(0)}% match)
   ${truncateSummary(match.summary)}`).join('\n\n')}

Reply with a number to learn more about that role, or ask about skill gaps or development plans.`;

          await logAgentResponse(
            supabase,
            sessionId,
            matchesMarkdown,
            'matches_found'
          );
        }

      }

    } catch (matchError) {
      console.error('Error during job matching:', matchError);
      return {
        success: false,
        message: 'Failed to find matching roles',
        error: {
          type: 'MATCHING_ERROR',
          message: 'Error during job matching process',
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
          skillAlignment: 0.8,
          capabilityAlignment: 0.75
        },
        matchingStrategy: 'semantic',
        confidenceScore: 0.9
      }
    });

    return {
      success: true,
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