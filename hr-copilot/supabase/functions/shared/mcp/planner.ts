import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { PlannerRecommendation, MCPContext } from '../mcpTypes.ts';
import { logAgentAction } from '../agent/logAgentAction.ts';

// Available MCP actions that can be recommended by the planner
const AVAILABLE_ACTIONS = {
  CANDIDATE_MODE: [
    {
      tool: 'getSuggestedCareerPaths',
      description: 'Get career path recommendations based on profile',
      requiresProfileId: true
    },
    {
      tool: 'getJobReadiness',
      description: 'Assess readiness for specific jobs',
      requiresProfileId: true,
      requiresJobId: true
    },
    {
      tool: 'getOpenJobs',
      description: 'Get list of available job opportunities',
      requiresProfileId: false
    },
    {
      tool: 'getCapabilityGaps',
      description: 'Analyze gaps in capabilities for a role',
      requiresProfileId: true,
      requiresRoleId: true
    },
    {
      tool: 'getSkillGaps',
      description: 'Analyze gaps in skills for a role',
      requiresProfileId: true,
      requiresRoleId: true
    },
    {
      tool: 'scoreProfileFit',
      description: 'Calculate overall fit score for a role',
      requiresProfileId: true,
      requiresRoleId: true
    }
  ],
  HIRING_MODE: [
    {
      tool: 'getMatchingProfiles',
      description: 'Find profiles that match role requirements',
      requiresRoleId: true
    },
    {
      tool: 'scoreProfileFit',
      description: 'Calculate fit score for a specific profile',
      requiresProfileId: true,
      requiresRoleId: true
    }
  ]
};

interface PlannerContext {
  mode: 'candidate' | 'hiring';
  profileId?: string;
  roleId?: string;
  jobId?: string;
  lastMessage?: string;
  semanticContext?: {
    currentFocus?: 'role' | 'skill' | 'capability' | 'company';
    previousMatches?: any[];
  };
}

/**
 * Analyzes the context and recommends which MCP actions to take
 */
export async function getPlannerRecommendation(
  supabase: SupabaseClient<Database>,
  context: PlannerContext
): Promise<PlannerRecommendation[]> {
  try {
    const { mode, profileId, roleId, lastMessage, semanticContext } = context;
    const recommendations: PlannerRecommendation[] = [];
    
    // Get available actions for the current mode
    const availableActions = mode === 'candidate' 
      ? AVAILABLE_ACTIONS.CANDIDATE_MODE 
      : AVAILABLE_ACTIONS.HIRING_MODE;

    // Basic action selection based on context
    if (mode === 'candidate' && profileId) {
      // Always get career path suggestions for candidates
      recommendations.push({
        tool: 'getSuggestedCareerPaths',
        reason: 'Providing career path recommendations based on profile context',
        confidence: 0.9,
        inputs: { profileId }
      });

      // If there's a specific role focus, analyze gaps
      if (roleId) {
        recommendations.push(
          {
            tool: 'getCapabilityGaps',
            reason: 'Analyzing capability gaps for target role',
            confidence: 0.85,
            inputs: { profileId, roleId }
          },
          {
            tool: 'getSkillGaps',
            reason: 'Analyzing skill gaps for target role',
            confidence: 0.85,
            inputs: { profileId, roleId }
          }
        );
      }

      // Get job recommendations if no specific role is targeted
      if (!roleId) {
        recommendations.push({
          tool: 'getOpenJobs',
          reason: 'Finding relevant job opportunities',
          confidence: 0.8,
          inputs: {}
        });
      }
    }

    // Hiring mode recommendations
    if (mode === 'hiring' && roleId) {
      recommendations.push({
        tool: 'getMatchingProfiles',
        reason: 'Finding candidates that match role requirements',
        confidence: 0.9,
        inputs: { roleId }
      });

      // If there's a specific profile to evaluate
      if (profileId) {
        recommendations.push({
          tool: 'scoreProfileFit',
          reason: 'Evaluating specific candidate fit for role',
          confidence: 0.85,
          inputs: { profileId, roleId }
        });
      }
    }

    // Log the planner's recommendations
    await logAgentAction(supabase, {
      entityType: mode === 'candidate' ? 'profile' : 'role',
      entityId: mode === 'candidate' ? profileId! : roleId!,
      payload: {
        action: 'planner_recommendation',
        recommendations,
        context: {
          mode,
          lastMessage,
          semanticContext
        }
      },
      semanticMetrics: {
        similarityScores: {},
        matchingStrategy: 'hybrid',
        confidenceScore: recommendations.reduce((acc, rec) => acc + rec.confidence, 0) / recommendations.length
      }
    });

    return recommendations;

  } catch (error) {
    console.error('Error in planner:', error);
    throw error;
  }
} 