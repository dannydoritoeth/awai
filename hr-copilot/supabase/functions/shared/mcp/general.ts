// @deno-types="https://esm.sh/v128/@supabase/supabase-js@2.7.1/dist/module/index.d.ts"
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { MCPRequest, MCPResponse, MCPAction, SemanticMatch, EntityType } from '../mcpTypes.ts';
import { logProgress } from '../chatUtils.ts';
import { getSemanticMatches } from '../semanticSearch.ts';
import { generateEmbedding } from '../semanticSearch.ts';
import { getPlannerRecommendation } from './planner.ts';
import { handleChatInteraction } from '../chatUtils.ts';
import { logAgentAction } from '../agent/logAgentAction.ts';

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
      
      // Log the no-matches case
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

    // Log match statistics
    try {
      console.log('Processing matches for response:', {
        totalMatches: matches.length,
        matchesByType: Object.entries(matchesByType).map(([type, matches]) => ({
          type,
          count: matches.length,
          avgSimilarity: matches.reduce((sum, m) => sum + m.similarity, 0) / matches.length,
          sampleMatch: matches[0] ? {
            id: matches[0].id,
            name: matches[0].name,
            similarity: matches[0].similarity
          } : null
        }))
      });
    } catch (statsError) {
      console.error('Error processing match statistics:', statsError);
    }

    // Prepare data for response generation
    console.log('Preparing ChatGPT prompt...');
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OpenAI API key not found');
    }

    // Format matches for prompt
    let matchesPromptSection = '';
    try {
      matchesPromptSection = Object.entries(matchesByType).map(([type, typeMatches]) => `
${type.toUpperCase()} Matches (showing top 5 of ${typeMatches.length}):
${formatMatchesForPrompt(typeMatches)}`).join('\n');
    } catch (formatError) {
      console.error('Error formatting matches for prompt:', formatError);
      matchesPromptSection = 'Error formatting matches';
    }

    // Format recommendations for prompt
    let recommendationsPromptSection = '';
    try {
      recommendationsPromptSection = formatRecommendationsForPrompt(recommendations);
    } catch (formatError) {
      console.error('Error formatting recommendations for prompt:', formatError);
      recommendationsPromptSection = 'Error formatting recommendations';
    }

    // Format the prompt with truncated data
    const prompt = `As an AI career advisor, analyze this data and provide insights about the most common skills in demand.

User's question: ${message}

Data:
${JSON.stringify({
  matches: matches.slice(0, 5),
  recommendations: recommendations.slice(0, 5)
}, null, 2)}

Please provide:
1. A clear, concise answer to the user's question
2. Specific insights from the matches
3. Actionable recommendations based on the data
4. A relevant follow-up question

Keep the tone conversational and focus on practical insights.`;

    console.log('Prompt prepared, logging to agent actions...');

    // Log the prompt being sent to ChatGPT
    await logAgentAction(supabase, {
      entityType: 'chat',
      entityId: loggingId,
      payload: {
        stage: 'chatgpt_prompt',
        message: prompt,
        metadata: {
          matchCount: matches.length,
          matchesByType: Object.fromEntries(
            Object.entries(matchesByType).map(([type, matches]) => [type, matches.length])
          ),
          recommendationCount: recommendations.length,
          truncatedMatchCount: Math.min(matches.length, 5),
          truncatedRecommendationCount: Math.min(recommendations.length, 5),
          timestamp: new Date().toISOString()
        }
      }
    });

    console.log('Making ChatGPT API call...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an experienced career advisor helping users understand workforce trends and opportunities. Focus on providing clear, actionable insights based on data analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    console.log('ChatGPT API response received, status:', response.status);
    
    const data = await response.json();
    
    // Validate the response data
    if (!response.ok) {
      throw new Error(`ChatGPT API error: ${data.error?.message || 'Unknown error'}`);
    }
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response format from ChatGPT API');
    }

    const chatResponse = data.choices[0].message.content;

    // Log the ChatGPT response
    await logAgentAction(supabase, {
      entityType: 'chat',
      entityId: loggingId,
      payload: {
        stage: 'chatgpt_response',
        message: chatResponse,
        metadata: {
          model: 'gpt-4-turbo-preview',
          temperature: 0.7,
          timestamp: new Date().toISOString(),
          responseStatus: response.status,
          responseOk: response.ok
        }
      }
    });

    // Split response into main content and follow-up question
    const parts = chatResponse.split(/\n\nFollow-up question:/i);
    return {
      response: parts[0].trim(),
      followUpQuestion: parts[1]?.trim(),
      prompt: prompt
    };
  } catch (error) {
    console.error('Error in generateGeneralResponse:', error);
    
    // Log the error with full context
    await logAgentAction(supabase, {
      entityType: 'chat',
      entityId: loggingId,
      payload: {
        stage: 'error',
        error: error.message,
        metadata: {
          timestamp: new Date().toISOString(),
          errorStack: error.stack,
          matchCount: matches?.length,
          recommendationCount: recommendations?.length,
          errorDetails: error
        }
      }
    });
    
    return {
      response: "I've analyzed the data but encountered an error generating a detailed response. The analysis shows some relevant matches and recommendations that could be helpful for your query. Would you like me to focus on a specific aspect of the findings?",
      followUpQuestion: undefined,
      prompt: ''
    };
  }
}

/**
 * Run the general analysis loop for data insights
 */
export async function runGeneralLoop(
  supabase: SupabaseClient,
  request: MCPRequest
): Promise<MCPResponse> {
  try {
    if (!request.context?.lastMessage) {
      throw new Error('Message is required for general analysis');
    }

    // Generate embedding for the message
    const embedding = await generateEmbedding(request.context.lastMessage);
    console.log('request.context.lastMessage:', request.context.lastMessage);

    console.log('Generated embedding for message:', {
      length: embedding.length,
      sample: embedding.slice(0, 5)
    });

    // Get semantic matches using getSemanticMatches
    const matches = await getSemanticMatches(supabase, {
      embedding,
      entityTypes: ['role', 'job', 'profile', 'division', 'company'],
      limit: 20,
      perTypeLimit: 10,
      minScore: 0.3
    });

    // Log matches by type
    const matchesByType = matches.reduce((acc, m) => {
      acc[m.type] = (acc[m.type] || []).concat(m);
      return acc;
    }, {} as Record<string, SemanticMatch[]>);

    console.log('Matches by type:', Object.entries(matchesByType).map(([type, matches]) => ({
      type,
      count: matches.length,
      matches: matches.map(m => ({
        id: m.id,
        name: m.name,
        similarity: m.similarity
      }))
    })));

    // Create recommendations from matches
    const recommendations = matches.map(match => ({
      type: 'semantic_match',
      score: match.similarity,
      semanticScore: match.similarity,
      summary: match.summary || `Found matching ${match.type}: ${match.name}`,
      details: {
        id: match.id,
        type: match.type,
        name: match.name,
        metadata: match.metadata
      }
    }));

    console.log('Generated recommendations:', {
      count: recommendations.length,
      samples: recommendations.slice(0, 2).map(r => ({
        type: r.type,
        score: r.score,
        summary: r.summary
      }))
    });

    // Generate chat response using both matches and recommendations
    const chatResponse = await generateGeneralResponse(
      supabase,
      request.context.lastMessage,
      matches,
      recommendations,
      request.sessionId
    );

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
            reason: 'Generated message embedding for semantic search',
            result: { length: embedding.length },
            confidence: 1.0,
            inputs: { message: request.context.lastMessage },
            timestamp: new Date().toISOString()
          },
          {
            tool: 'getSemanticMatches',
            reason: 'Retrieved semantic matches across entities',
            result: { matchCount: matches.length },
            confidence: 0.9,
            inputs: { entityTypes: ['role', 'job', 'profile', 'division', 'company'] },
            timestamp: new Date().toISOString()
          },
          {
            tool: 'createRecommendations',
            reason: 'Created recommendations from matches',
            result: { recommendationCount: recommendations.length },
            confidence: 0.85,
            inputs: { matches: matches.length },
            timestamp: new Date().toISOString()
          },
          {
            tool: 'generateInsights',
            reason: 'Generated AI insights from data',
            result: { hasResponse: !!chatResponse.response },
            confidence: 0.8,
            inputs: { 
              matchCount: matches.length,
              recommendationCount: recommendations.length 
            },
            timestamp: new Date().toISOString()
          }
        ]
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