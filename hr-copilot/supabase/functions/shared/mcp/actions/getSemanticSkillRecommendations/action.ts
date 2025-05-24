/**
 * @fileoverview Recommends skills based on skill gap analysis using semantic matching and AI insights
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
import { invokeChatModelV2 } from '../../../ai/invokeAIModelV2.ts';
import { logAgentProgress } from '../../../chatUtils.ts';
import { buildSkillRecommendationsPrompt } from './buildPrompt.ts';
import { buildSafePrompt } from '../../../ai/buildSafePrompt.ts';
import { getLevelValue } from '../../../utils.ts';

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

    console.log('Fetching skills data:', { profileId, roleId });

    const [profileSkillsResult, roleSkillsResult] = await Promise.all([
      supabase
        .from('profile_skills')
        .select(`
          skill_id,
          rating,
          evidence,
          skills!inner (
            id,
            name,
            category
          )
        `)
        .eq('profile_id', profileId),
      supabase
        .from('role_skills')
        .select(`
          skill_id,
          skills!inner (
            id,
            name,
            category
          )
        `)
        .eq('role_id', roleId)
    ]);

    console.log('Skills data fetch results:', {
      profileSkills: {
        error: profileSkillsResult.error,
        count: profileSkillsResult.data?.length || 0,
        data: profileSkillsResult.data?.[0]
      },
      roleSkills: {
        error: roleSkillsResult.error,
        count: roleSkillsResult.data?.length || 0,
        data: roleSkillsResult.data?.[0]
      }
    });

    if (profileSkillsResult.error) {
      throw new Error(`Failed to fetch profile skills: ${profileSkillsResult.error.message}`);
    }

    if (roleSkillsResult.error) {
      throw new Error(`Failed to fetch role skills: ${roleSkillsResult.error.message}`);
    }

    // Even if no error, check if we got data
    if (!profileSkillsResult.data || !roleSkillsResult.data) {
      throw new Error('No skills data returned from database');
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
      profileSkills: profileSkillsResult.data.map(ps => ({
        id: ps.skill_id,
        name: ps.skills.name,
        level: getLevelValue(ps.rating)
      })),
      roleSkills: roleSkillsResult.data.map(rs => ({
        id: rs.skill_id,
        name: rs.skills.name,
        required_level: 3 // Default to intermediate since schema doesn't store level
      })),
      semanticMatches,
      sessionId
    };

    const aiContext = prepareAIContext(context);
    const prompt = buildSkillRecommendationsPrompt(aiContext);
    const safePrompt = buildSafePrompt(prompt);

    const aiResponse = await invokeChatModelV2(
      {
        system: safePrompt.system,
        user: safePrompt.user
      },
      {
        model: 'openai:gpt-3.5-turbo',
        temperature: 0.2,
        max_tokens: 2000,
        supabase,
        sessionId: sessionId || 'default',
        actionType: 'getSemanticSkillRecommendations'
      }
    );

    if (!aiResponse.success || !aiResponse.output) {
      throw new Error(`AI API error: ${aiResponse.error?.message || 'Unknown error'}`);
    }

    // Strip markdown code block markers if present
    const cleanOutput = aiResponse.output
      .replace(/^```json\n/, '')  // Remove opening code block
      .replace(/\n```$/, '')      // Remove closing code block
      .trim();                    // Clean up whitespace

    console.log('Parsing AI response:', {
      originalOutput: aiResponse.output,
      cleanOutput
    });

    let recommendations: SkillRecommendations;
    let recommendationsMarkdown = '';
    
    try {
      // Try to parse the cleaned output
      try {
        recommendations = JSON.parse(cleanOutput) as SkillRecommendations;
      } catch (parseError) {
        console.error('Initial parse failed, attempting to fix common JSON issues:', parseError);
        
        // Try to fix common JSON issues
        const fixedOutput = cleanOutput
          .replace(/\n/g, ' ')  // Remove newlines
          .replace(/,\s*}/g, '}')  // Remove trailing commas
          .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
          .trim();
          
        console.log('Attempting to parse fixed output:', fixedOutput);
        recommendations = JSON.parse(fixedOutput) as SkillRecommendations;
      }
      
      // Filter out invalid recommendations where current level exceeds target level
      recommendations.recommendations = recommendations.recommendations.filter(rec => {
        const currentLevel = rec.currentLevel || 0;
        return currentLevel < rec.targetLevel;
      });

      // Generate markdown if we have recommendations
      if (recommendations.recommendations.length > 0) {
        recommendationsMarkdown = `### 🎯 Skill Recommendations

${recommendations.recommendations.map(rec => `**${rec.name}** (Priority: ${rec.priority})
${rec.explanation}
Current Level: ${rec.currentLevel || 'Not Present'} → Target Level: ${rec.targetLevel}

Learning Path:
${rec.learningPath.map(path => `- ${path.resource} (${path.type}, ${path.duration}${path.provider ? `, by ${path.provider}` : ''})`).join('\n')}`).join('\n\n')}

${recommendations.explanation}`;
      }

      // Post to chat if we have a session
      if (sessionId) {
        await logAgentProgress(
          supabase,
          sessionId,
          recommendations.recommendations.length > 0 
            ? recommendationsMarkdown 
            : "No skill gaps identified that require development. Your current skills meet or exceed the requirements.",
          { 
            phase: recommendations.recommendations.length > 0 
              ? 'recommendations_generated' 
              : 'no_recommendations_needed' 
          }
        );
      }
      
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      throw new Error(`Failed to parse AI recommendations: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`);
    }

    return {
      success: true,
      data: {
        recommendations: recommendations.recommendations,
        explanation: recommendations.explanation,
        rawAiResponse: aiResponse.output
      },
      dataForDownstreamPrompt: {
        getSemanticSkillRecommendations: {
          dataSummary: recommendationsMarkdown || "No skill gaps identified that require development.",
          structured: {
            recommendationCount: recommendations.recommendations.length,
            highPriorityCount: recommendations.recommendations.filter(r => r.priority === 'high').length,
            mediumPriorityCount: recommendations.recommendations.filter(r => r.priority === 'medium').length,
            lowPriorityCount: recommendations.recommendations.filter(r => r.priority === 'low').length,
            topRecommendations: recommendations.recommendations.slice(0, 3).map(r => ({
              name: r.name,
              priority: r.priority,
              targetLevel: r.targetLevel
            }))
          },
          truncated: false
        }
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
      await logAgentProgress(
        supabase,
        sessionId,
        "I encountered an error while generating skill recommendations. Let me know if you'd like to try again.",
        { phase: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
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
  description: 'Recommend skills based on skill gap analysis using semantic matching',
  applicableRoles: ['candidate', 'manager'],
  capabilityTags: ['Career Development', 'Skill Development', 'AI Analysis'],
  requiredInputs: ['profileId', 'roleId'],
  tags: ['skill_recommendations', 'tactical', 'strategic'],
  suggestedPrerequisites: ['getCapabilityGaps'],
  suggestedPostrequisites: ['getDevelopmentPlan'],
  usesAI: true,
  actionFn: (ctx: Record<string, any>) => getSemanticSkillRecommendationsBase(ctx as MCPRequest),
  getDefaultArgs: (context: Record<string, any>) => ({
    profileId: context.profileId,
    roleId: context.roleId
  })
}; 