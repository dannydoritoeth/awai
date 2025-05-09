import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { MCPRequest, MCPResponse } from '../mcpTypes.ts';
import { logProgress } from '../chatUtils.ts';
import { getSemanticMatches } from '../embeddings.ts';

/**
 * Run the general analysis loop for data insights
 */
export async function runGeneralLoop(
  supabase: SupabaseClient,
  request: MCPRequest
): Promise<MCPResponse> {
  try {
    // Log the start of analysis
    await logProgress(supabase, {
      entityType: 'general',
      entityId: 'analysis',
      stage: 'planning',
      message: "Starting general data analysis...",
      sessionId: request.sessionId
    });

    // Initialize response data
    let insights = [];
    let recommendations = [];
    let actionsTaken = [];

    // Process based on planner recommendations or message context
    if (request.context?.lastMessage) {
      const message = request.context.lastMessage.toLowerCase();

      // Analyze message intent and gather relevant data
      if (message.includes('skill') || message.includes('capability')) {
        // Analyze skill/capability distribution
        const { data: skills } = await supabase
          .from('skills')
          .select('name, category')
          .order('category');

        const { data: capabilities } = await supabase
          .from('capabilities')
          .select('name, category')
          .order('category');

        insights.push({
          type: 'skill_analysis',
          data: {
            skills: skills || [],
            capabilities: capabilities || []
          }
        });

        actionsTaken.push({
          tool: 'analyzeSkillsAndCapabilities',
          reason: 'User inquired about skills/capabilities',
          result: { skillCount: skills?.length, capabilityCount: capabilities?.length }
        });
      }

      if (message.includes('role') || message.includes('job')) {
        // Analyze role distribution and trends
        const { data: roles } = await supabase
          .from('roles')
          .select('title, department, level')
          .order('department');

        insights.push({
          type: 'role_analysis',
          data: {
            roles: roles || [],
            departments: [...new Set(roles?.map(r => r.department) || [])]
          }
        });

        actionsTaken.push({
          tool: 'analyzeRoles',
          reason: 'User inquired about roles/jobs',
          result: { roleCount: roles?.length }
        });
      }

      if (message.includes('trend') || message.includes('pattern')) {
        // Analyze hiring trends and patterns
        const { data: matches } = await supabase
          .from('profile_role_matches')
          .select('score, created_at')
          .order('created_at', { ascending: false })
          .limit(100);

        insights.push({
          type: 'trend_analysis',
          data: {
            recentMatches: matches || [],
            averageScore: matches?.reduce((acc, m) => acc + m.score, 0) / (matches?.length || 1)
          }
        });

        actionsTaken.push({
          tool: 'analyzeTrends',
          reason: 'User inquired about trends/patterns',
          result: { matchCount: matches?.length }
        });
      }

      // Get semantic context if available
      if (request.context.semanticContext) {
        const semanticMatches = await getSemanticMatches(
          supabase,
          { id: 'general', table: 'general_insights' },
          'roles',
          5,
          0.3
        );

        insights.push({
          type: 'semantic_analysis',
          data: {
            matches: semanticMatches
          }
        });

        actionsTaken.push({
          tool: 'semanticAnalysis',
          reason: 'Enriching response with semantic context',
          result: { matchCount: semanticMatches.length }
        });
      }
    }

    // Generate recommendations based on insights
    recommendations = insights.map(insight => ({
      type: insight.type,
      summary: `Analysis of ${insight.type.replace('_', ' ')}`,
      details: insight.data
    }));

    // Log completion
    await logProgress(supabase, {
      entityType: 'general',
      entityId: 'analysis',
      stage: 'summary',
      message: `Completed analysis with ${insights.length} insights`,
      sessionId: request.sessionId,
      payload: { insights, recommendations }
    });

    return {
      success: true,
      message: 'General analysis completed successfully',
      data: {
        insights,
        recommendations,
        actionsTaken,
        nextActions: ['refine_analysis', 'explore_specific_area', 'get_detailed_stats']
      }
    };

  } catch (error) {
    console.error('General analysis error:', error);
    return {
      success: false,
      message: error.message,
      error: {
        type: 'ANALYSIS_ERROR',
        message: error.message,
        details: error
      }
    };
  }
} 