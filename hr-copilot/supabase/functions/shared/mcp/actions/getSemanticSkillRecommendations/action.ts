/**
 * @fileoverview Recommends skills based on role gap analysis using semantic matching and AI insights
 * 
 * Inputs:
 * - profileId: ID of the profile to analyze
 * - roleId: ID of the target role
 * 
 * Outputs:
 * - Prioritized list of recommended skills with learning paths
 * - AI-generated explanation of recommendations
 * 
 * Related Actions:
 * - getCapabilityGaps: Used to understand current gaps
 * - getDevelopmentPlan: Uses these recommendations in planning
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../../database.types.ts';
import { MCPActionV2, MCPRequest, MCPResponse } from '../../types/action.ts';
import { getSemanticMatches } from '../../../embeddings.ts';
import { invokeChatModel } from '../../../ai/invokeAIModel.ts';
import { logAgentAction } from '../../../agent/logAgentAction.ts';
import { logAgentResponse } from '../../../chatUtils.ts';
import { buildSkillRecommendationsPrompt } from './buildPrompt.ts';
import { buildSafePrompt } from '../../../ai/buildSafePrompt.ts';

// Types for internal context vs AI context separation
interface ActionContext {
  profileId: string;
  roleId: string;
  profileSkills: Array<{
    id: string;
    name: string;
    level: number;
  }>;
  roleSkills: Array<{
    id: string;
    name: string;
    required_level: number;
  }>;
  semanticMatches: Array<{
    id: string;
    name: string;
    similarity: number;
    metadata?: any;
  }>;
  sessionId?: string;
}

interface AIContext {
  currentSkills: Array<{
    name: string;
    level: number;
  }>;
  roleSkills: Array<{
    name: string;
    requiredLevel: number;
  }>;
  semanticRecommendations: Array<{
    name: string;
    relevance: number;
    description?: string;
  }>;
}

export interface SkillRecommendation {
  name: string;
  priority: 'high' | 'medium' | 'low';
  relevance: number;
  currentLevel?: number;
  targetLevel: number;
  learningPath: Array<{
    resource: string;
    type: string;
    duration: string;
    provider?: string;
  }>;
  explanation: string;
}

export interface SkillRecommendations {
  recommendations: SkillRecommendation[];
  explanation: string;
  rawAiResponse: string;
}

/**
 * Prepares minimal context needed for AI processing
 */
function prepareAIContext(context: ActionContext): AIContext {
  return {
    currentSkills: context.profileSkills.map(s => ({
      name: s.name,
      level: s.level
    })),
    roleSkills: context.roleSkills.map(s => ({
      name: s.name,
      requiredLevel: s.required_level
    })),
    semanticRecommendations: context.semanticMatches.map(m => ({
      name: m.name,
      relevance: m.similarity,
      description: m.metadata?.description
    }))
  };
}

/**
 * Main action function that implements the MCPActionV2 interface
 */
async function getSemanticSkillRecommendationsBase(
  request: MCPRequest
): Promise<MCPResponse<SkillRecommendations>> {
  const supabase = request.supabase as SupabaseClient<Database>;
  const { profileId, roleId, sessionId } = request;

  try {
    // Validate inputs
    if (!profileId || !roleId) {
      return {
        success: false,
        error: {
          type: 'INVALID_INPUT',
          message: 'Both profileId and roleId are required'
        }
      };
    }

    // Phase 1: Load profile and role skills
    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        "Loading current skills and role requirements...",
        'data_gathered'
      );
    }

    const [profileSkills, roleSkills] = await Promise.all([
      supabase
        .from('profile_skills')
        .select('id, name, level')
        .eq('profile_id', profileId),
      supabase
        .from('role_skills')
        .select('id, name, required_level')
        .eq('role_id', roleId)
    ]);

    if (profileSkills.error || roleSkills.error) {
      throw new Error('Failed to fetch skills data');
    }

    // Phase 2: Get semantic matches
    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        "Finding semantically related skills...",
        'data_gathered'
      );
    }

    const semanticMatches = await getSemanticMatches(
      supabase,
      { id: roleId, table: 'roles' },
      'skills',
      10,
      0.7
    );

    // Prepare contexts
    const context: ActionContext = {
      profileId,
      roleId,
      profileSkills: profileSkills.data || [],
      roleSkills: roleSkills.data || [],
      semanticMatches,
      sessionId
    };

    const aiContext = prepareAIContext(context);

    // Phase 3: Generate recommendations
    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        "Analyzing skills and generating recommendations...",
        'prompt_built'
      );
    }

    const prompt = buildSkillRecommendationsPrompt(aiContext);
    const safePrompt = buildSafePrompt(prompt);

    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        "Generating AI-powered skill recommendations...",
        'ai_invoked'
      );
    }

    const aiResponse = await invokeChatModel(
      {
        system: safePrompt.system,
        user: safePrompt.user
      },
      {
        model: 'openai:gpt-3.5-turbo',
        temperature: 0.2,
        max_tokens: 1000
      }
    );

    if (!aiResponse.success || !aiResponse.output) {
      throw new Error(`AI API error: ${aiResponse.error?.message || 'Unknown error'}`);
    }

    // Phase 4: Process and validate recommendations
    const recommendations = JSON.parse(aiResponse.output) as SkillRecommendations;

    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        "Finalizing skill recommendations...",
        'response_received'
      );
    }

    // Log completion
    await logAgentAction(supabase, {
      entityType: 'profile',
      entityId: profileId,
      payload: {
        action: 'skill_recommendations_generated',
        summary: {
          totalRecommendations: recommendations.recommendations.length,
          highPriorityCount: recommendations.recommendations.filter(r => r.priority === 'high').length
        },
        prompt: safePrompt,
        aiResponse: {
          summary: recommendations.explanation,
          raw: aiResponse.output
        }
      },
      semanticMetrics: {
        similarityScores: {
          roleMatch: 0.8,
          skillAlignment: semanticMatches.length > 0 ? semanticMatches[0].similarity : 0
        },
        matchingStrategy: 'semantic',
        confidenceScore: 0.9
      }
    });

    return {
      success: true,
      data: {
        recommendations: recommendations.recommendations,
        explanation: recommendations.explanation,
        rawAiResponse: aiResponse.output
      },
      actionsTaken: [
        {
          tool: 'getSkillsData',
          reason: 'Retrieved profile and role skills',
          result: 'success',
          confidence: 1.0,
          inputs: { profileId, roleId },
          timestamp: new Date().toISOString()
        },
        {
          tool: 'semanticSearch',
          reason: 'Found semantically related skills',
          result: 'success',
          confidence: 0.9,
          inputs: { roleId },
          timestamp: new Date().toISOString()
        },
        {
          tool: 'generateRecommendations',
          reason: 'Generated AI-powered skill recommendations',
          result: 'success',
          confidence: 0.85,
          inputs: { profileId, roleId },
          timestamp: new Date().toISOString()
        }
      ],
      nextActions: [
        {
          type: 'review_recommendations',
          description: 'Review suggested skills and learning paths',
          priority: 'high'
        },
        {
          type: 'create_development_plan',
          description: 'Create detailed development plan',
          priority: 'medium'
        }
      ]
    };

  } catch (error) {
    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        "I encountered an error while generating skill recommendations. Let me know if you'd like to try again.",
        'recommendation_error'
      );
    }

    return {
      success: false,
      error: {
        type: 'RECOMMENDATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error
      }
    };
  }
}

// Create the MCPActionV2 implementation
export const getSemanticSkillRecommendations: MCPActionV2 = {
  id: 'getSemanticSkillRecommendations',
  title: 'Get Semantic Skill Recommendations',
  description: 'Recommend skills based on role gap analysis using semantic matching',
  applicableRoles: ['candidate', 'manager'],
  capabilityTags: ['Career Development', 'Skill Development', 'AI Analysis'],
  requiredInputs: ['profileId', 'roleId'],
  tags: ['skill_recommendations', 'tactical', 'strategic'],
  recommendedAfter: ['getCapabilityGaps'],
  recommendedBefore: ['getDevelopmentPlan'],
  usesAI: true,
  actionFn: (ctx: Record<string, any>) => getSemanticSkillRecommendationsBase(ctx as MCPRequest),
  getDefaultArgs: (context: Record<string, any>) => ({
    profileId: context.profileId,
    roleId: context.roleId
  })
}; 