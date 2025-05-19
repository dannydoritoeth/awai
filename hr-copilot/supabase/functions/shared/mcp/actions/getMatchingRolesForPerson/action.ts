/**
 * @fileoverview Finds and analyzes matching roles for a given profile
 * 
 * Related Actions:
 * - getCapabilityGaps: Used to analyze fit with potential roles
 * - getDevelopmentPlan: Can be used to create plan for target roles
 * - getSkillGaps: Used to assess technical fit with roles
 */

import { SupabaseClient } from '@supabase/supabase-js';
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
  const matches: SemanticMatch[] = [];
  const recommendations: any[] = [];

  try {
    // Validate inputs
    if (!profileId) {
      return {
        success: false,
        message: 'Invalid input: profileId is required',
        error: {
          type: 'INVALID_INPUT',
          message: 'ProfileId is required'
        }
      };
    }

    // Phase 1: Load profile data
    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        "Loading your profile data to find matching roles...",
        'data_loading'
      );
    }

    const [profileContext, profileData] = await Promise.all([
      getProfileContext(supabase, profileId),
      getProfileData(supabase, profileId)
    ]);

    if (!profileContext.data || !profileData) {
      throw new Error('Could not fetch profile data');
    }

    // Phase 2: Find matching jobs
    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        "Searching for roles that match your profile...",
        'finding_matches'
      );
    }

    const jobMatchingResult = await testJobMatching(supabase, profileId, {
      limit: 20,
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
          averageSimilarity: matches.reduce((acc, m) => acc + m.similarity, 0) / matches.length
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
        profile: profileContext.data as unknown as ProfileContext
      }
    };

  } catch (error) {
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
  actionFn: (ctx: Record<string, any>) => getMatchingRolesForPersonBase(ctx as MCPRequest)
}; 