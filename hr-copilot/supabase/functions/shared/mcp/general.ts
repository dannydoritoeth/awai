// @deno-types="https://esm.sh/v128/@supabase/supabase-js@2.7.1/dist/module/index.d.ts"
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { MCPRequest, MCPResponse, MCPAction, SemanticMatch, EntityType } from '../mcpTypes.ts';
import { logProgress, logAgentResponse, handleChatInteraction } from '../chatUtils.ts';
import { getSemanticMatches, generateEmbedding } from '../semanticSearch.ts';
import { getPlannerRecommendation } from './planner.ts';
import { logAgentAction } from '../agent/logAgentAction.ts';
import { buildSafePrompt } from './promptBuilder.ts';
import { invokeChatModel } from '../ai/invokeAIModel.ts';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

interface AnalysisInsight {
  type: string;
  data: any;
  summary?: string;
}

interface StatsResult {
  count: number;
  distribution: Record<string, number>;
  topValues: string[];
  summary: string;
}

interface ActionResult {
  tool: string;
  reason: string;
  result: any;
  metadata?: Record<string, any>;
}

/**
 * Analyze statistics for a given entity type
 */
async function analyzeStats(
  supabase: SupabaseClient,
  entityType: EntityType,
  groupBy?: string
): Promise<StatsResult> {
  const { data, error } = await supabase
    .from(entityType === 'role' ? 'roles' : entityType === 'profile' ? 'profiles' : 'jobs')
    .select(groupBy ? `${groupBy}, division:divisions (name, cluster, agency)` : '*');

  if (error) throw error;

  const distribution = data.reduce((acc: Record<string, number>, item) => {
    const key = groupBy ? item[groupBy] : item.division?.cluster || 'Unspecified';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const topValues = Object.entries(distribution)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([key]) => key);

  return {
    count: data.length,
    distribution,
    topValues,
    summary: `Found ${data.length} ${entityType}s${groupBy ? `, primarily in: ${topValues.join(', ')}` : ''}`
  };
}

/**
 * Truncate and format match data for the prompt
 */
function formatMatchesForPrompt(matches: SemanticMatch[], limit: number = 5): string {
  return matches
    .slice(0, limit)
    .map(match => {
      // Truncate metadata to essential fields only
      const metadata = match.metadata ? {
        division: match.metadata.division,
        cluster: match.metadata.cluster,
        agency: match.metadata.agency
      } : {};

      return `- ${match.name || 'Unnamed'} (${match.type}, similarity: ${(match.similarity * 100).toFixed(1)}%)
  Summary: ${(match.summary || 'No summary available').slice(0, 200)}
  Key Details: ${JSON.stringify(metadata)}`;
    })
    .join('\n');
}

/**
 * Truncate and format recommendations for the prompt
 */
function formatRecommendationsForPrompt(recommendations: any[], limit: number = 5): string {
  return recommendations
    .slice(0, limit)
    .map(rec => {
      // Extract only essential details
      const details = rec.details ? {
        id: rec.details.id,
        type: rec.details.type,
        name: rec.details.name
      } : {};

      return `- ${rec.type}: ${(rec.summary || '').slice(0, 200)}
  Score: ${(rec.score * 100).toFixed(1)}%
  Key Details: ${JSON.stringify(details)}`;
    })
    .join('\n');
}

/**
 * Generate a user-friendly response from insights
 */
async function generateGeneralResponse(
  supabase: SupabaseClient<Database>,
  message: string,
  matches: SemanticMatch[],
  recommendations: any[],
  sessionId?: string
): Promise<{ response: string; followUpQuestion?: string; prompt: string }> {
  const loggingId = sessionId || `chat_${Date.now()}`;
  
  try {
    console.log('Starting generateGeneralResponse with:', {
      messageLength: message?.length,
      matchCount: matches?.length,
      recommendationCount: recommendations?.length
    });

    // Validate inputs
    if (!Array.isArray(matches)) {
      throw new Error('Matches must be an array');
    }
    if (!Array.isArray(recommendations)) {
      throw new Error('Recommendations must be an array');
    }

    // Group matches by type for better analysis
    console.log('Grouping matches by type...');
    const matchesByType = matches.reduce((acc, m) => {
      if (!m || !m.type) {
        console.warn('Invalid match found:', m);
        return acc;
      }
      acc[m.type] = (acc[m.type] || []).concat(m);
      return acc;
    }, {} as Record<string, SemanticMatch[]>);

    console.log('Matches grouped by type:', Object.keys(matchesByType));

    // Check if we have any valid matches
    const hasValidMatches = Object.values(matchesByType).some(typeMatches => typeMatches.length > 0);
    console.log('Has valid matches:', hasValidMatches);

    if (!hasValidMatches) {
      const response = "I've analyzed your request but couldn't find any relevant matches. Would you like to try a different search approach or explore other areas?";
      
      await logAgentAction(supabase, {
        entityType: 'chat',
        entityId: loggingId,
        payload: {
          stage: 'no_matches',
          message: response,
          metadata: {
            userQuery: message,
            timestamp: new Date().toISOString()
          }
        }
      });

      return {
        response,
        followUpQuestion: "Would you like me to broaden the search criteria or focus on a specific aspect of your query?",
        prompt: ''
      };
    }

    // Prepare data for response generation
    const promptData = {
      systemPrompt: 'You are an AI assistant helping to analyze and explain matches and recommendations.',
      userMessage: message,
      data: {
        matches: formatMatchesForPrompt(matches),
        recommendations: formatRecommendationsForPrompt(recommendations),
        matchesByType: Object.entries(matchesByType).map(([type, matches]) => ({
          type,
          count: matches.length,
          avgSimilarity: matches.reduce((sum, m) => sum + m.similarity, 0) / matches.length
        }))
      }
    };

    const prompt = buildSafePrompt('openai:gpt-3.5-turbo', promptData, {
      maxItems: 5,
      maxFieldLength: 200
    });

    const aiResponse = await invokeChatModel(
      {
        system: prompt.system,
        user: prompt.user
      },
      {
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        max_tokens: 1000
      }
    );

    if (!aiResponse.success) {
      throw new Error(`AI API error: ${aiResponse.error?.message || 'Unknown error'}`);
    }

    const parts = (aiResponse.output || '').split(/\n\nFollow-up question:/i);
    return {
      response: parts[0].trim(),
      followUpQuestion: parts[1]?.trim(),
      prompt: prompt.user
    };

  } catch (error) {
    console.error('Error in generateGeneralResponse:', error);
    return {
      response: "I encountered an error while analyzing the data. Let me know if you'd like to try a different approach.",
      followUpQuestion: "Would you like me to focus on a specific aspect of your query?",
      prompt: 'Error occurred while generating response'
    };
  }
}

/**
 * Run the general analysis loop for data insights
 */
export async function runGeneralLoop(
  supabase: SupabaseClient<Database>,
  request: MCPRequest
): Promise<MCPResponse> {
  try {
    const { context, sessionId } = request;
    const matches: SemanticMatch[] = [];
    const recommendations: any[] = [];

    // Log starting analysis
    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        "I'm analyzing your request and searching across our knowledge base...",
        'mcp_analysis_start'
      );
    }

    // Get semantic matches based on the message
    const embedding = await generateEmbedding(context?.lastMessage || '');

    // Log embedding generated
    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        "I've processed your request and am now finding relevant matches...",
        'mcp_data_loaded'
      );
    }

    // Get semantic matches across different entity types
    const [roleMatches, profileMatches, skillMatches] = await Promise.all([
      getSemanticMatches(supabase, {
        embedding,
        entityTypes: ['role'],
        limit: 10,
        minScore: 0.5
      }),
      getSemanticMatches(supabase, {
        embedding,
        entityTypes: ['profile'],
        limit: 10,
        minScore: 0.5
      }),
      getSemanticMatches(supabase, {
        embedding,
        entityTypes: ['skill'],
        limit: 10,
        minScore: 0.5
      })
    ]);

    // Add all matches to the response
    matches.push(...roleMatches, ...profileMatches, ...skillMatches);

    // Log matches found
    if (sessionId && matches.length > 0) {
      await logAgentResponse(
        supabase,
        sessionId,
        `I've found ${matches.length} relevant matches across roles, profiles, and skills. Analyzing the results...`,
        'mcp_matches_found'
      );
    }

    // Sort matches by similarity
    matches.sort((a, b) => b.similarity - a.similarity);

    // Generate recommendations based on matches
    recommendations.push(
      ...matches.map(match => ({
        type: match.type,
        score: match.similarity,
        summary: match.summary || `${match.type} match: ${match.name}`,
        details: match.metadata
      }))
    );

    // Generate insights using ChatGPT
    const chatResponse = await generateGeneralResponse(
      supabase,
      context?.lastMessage || '',
      matches,
      recommendations,
      sessionId
    );

    // Log the final AI response to chat
    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        chatResponse.response,
        'mcp_final_response',
        undefined,
        {
          matches: matches.slice(0, 5),
          recommendations: recommendations.slice(0, 3),
          followUpQuestion: chatResponse.followUpQuestion
        }
      );
    }

    // Log the MCP run
    await logAgentAction(supabase, {
      entityType: 'chat',
      entityId: sessionId || 'general',
      payload: {
        action: 'mcp_loop_complete',
        mode: 'general',
        matches: matches.slice(0, 10),
        recommendations: recommendations.slice(0, 5)
      },
      semanticMetrics: {
        similarityScores: {
          roleMatch: matches.find(m => m.type === 'role')?.similarity,
          skillAlignment: matches.find(m => m.type === 'skill')?.similarity,
          capabilityAlignment: matches.find(m => m.type === 'capability')?.similarity
        },
        matchingStrategy: 'semantic',
        confidenceScore: matches.length > 0 ? matches[0].similarity : 0
      }
    });

    return {
      success: true,
      message: 'General analysis completed successfully',
      data: {
        matches,
        recommendations,
        chatResponse: {
          message: chatResponse.response,
          followUpQuestion: chatResponse.followUpQuestion,
          aiPrompt: chatResponse.prompt
        },
        nextActions: [
          'Review semantic matches',
          'Explore recommended paths',
          'Analyze skill requirements',
          'Consider alternative roles'
        ],
        actionsTaken: [
          {
            tool: 'generateEmbedding',
            reason: 'Processed query embedding for semantic search',
            result: { length: embedding.length },
            confidence: 0.9,
            inputs: { message: context?.lastMessage },
            timestamp: new Date().toISOString()
          },
          {
            tool: 'semanticSearch',
            reason: 'Found semantic matches across roles, profiles, and skills',
            result: { matchCount: matches.length },
            confidence: matches.length > 0 ? 0.8 : 0.5,
            inputs: { entityTypes: ['role', 'profile', 'skill'] },
            timestamp: new Date().toISOString()
          },
          {
            tool: 'generateRecommendations',
            reason: 'Generated recommendations based on matches',
            result: { count: recommendations.length },
            confidence: 0.7,
            inputs: { matches: matches.slice(0, 5) },
            timestamp: new Date().toISOString()
          },
          {
            tool: 'completeAnalysis',
            reason: 'Completed general analysis with insights',
            result: { success: true },
            confidence: 0.8,
            inputs: {},
            timestamp: new Date().toISOString()
          }
        ]
      }
    };

  } catch (error) {
    console.error('Error in general loop:', error);

    // Log error to chat if we have a session
    if (request.sessionId) {
      await logAgentResponse(
        supabase,
        request.sessionId,
        "I encountered an error while analyzing your request. Let me know if you'd like to try again.",
        'mcp_error'
      );
    }

    return {
      success: false,
      message: error.message,
      error: {
        type: 'PLANNER_ERROR',
        message: 'Failed to run general loop',
        details: error
      }
    };
  }
} 