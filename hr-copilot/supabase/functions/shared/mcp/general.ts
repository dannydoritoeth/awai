import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { MCPRequest, MCPResponse, MCPAction, SemanticMatch, EntityType } from '../mcpTypes.ts';
import { logProgress } from '../chatUtils.ts';
import { getSemanticMatches } from '../semanticSearch.ts';
import { generateEmbedding } from '../semanticSearch.ts';
import { getPlannerRecommendation } from './planner.ts';
import { handleChatInteraction } from '../chatUtils.ts';

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
 * Generate a user-friendly response from insights
 */
async function generateGeneralResponse(
  message: string,
  insights: AnalysisInsight[],
  recommendations: any[]
): Promise<{ response: string; followUpQuestion?: string }> {
  try {
    // Prepare data for response generation
    const matchData = insights
      .filter(i => i.type === 'semantic_matches')
      .map(i => i.data)
      .flat();

    const statsData = insights
      .filter(i => i.type === 'statistical_analysis')
      .map(i => i.data);

    // Call ChatGPT API
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OpenAI API key not found');
    }

    const prompt = `As an AI career advisor, analyze this data and provide insights about the most common skills in demand.

User's question: ${message}

Semantic Matches:
${matchData.map(match => `- ${match.name || 'Unnamed'}: ${match.summary || 'No summary'}`).join('\n')}

Statistical Analysis:
${statsData.map(stat => `- ${stat.summary || 'No summary available'}`).join('\n')}

Please provide:
1. A clear, concise answer to the user's question
2. Specific insights from the data
3. Actionable recommendations
4. A relevant follow-up question

Keep the tone conversational and focus on practical insights.`;

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

    const data = await response.json();
    const chatResponse = data.choices[0].message.content;

    // Split response into main content and follow-up question
    const parts = chatResponse.split(/\n\nFollow-up question:/i);
    return {
      response: parts[0].trim(),
      followUpQuestion: parts[1]?.trim()
    };
  } catch (error) {
    console.error('Error generating response:', error);
    return {
      response: "I've analyzed the data but encountered an error generating a detailed response. The analysis shows some relevant matches and statistics that could be helpful for your query. Would you like me to focus on a specific aspect of the findings?",
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
    const insights: AnalysisInsight[] = [];
    const actionsTaken: MCPAction[] = [];

    // Log the start of analysis
    await logProgress(supabase, {
      entityType: 'profile',
      entityId: request.sessionId || undefined,
      stage: 'planning',
      message: "Starting AI-guided analysis...",
      sessionId: request.sessionId
    });

    if (!request.context?.lastMessage) {
      throw new Error('Message is required for general analysis');
    }

    // 1. Generate embedding for the user's message
    const embedding = await generateEmbedding(request.context.lastMessage);
    
    // 2. Get planner recommendations
    const plannerRecommendations = await getPlannerRecommendation(supabase, {
      mode: 'general',
      lastMessage: request.context.lastMessage,
      semanticContext: request.context.semanticContext
    });

    // 3. Execute planner recommendations
    for (const rec of plannerRecommendations) {
      try {
        switch (rec.tool) {
          case 'getSemanticMatches': {
            const matches = await getSemanticMatches(supabase, {
              embedding,
              entityTypes: rec.inputs.entityTypes || ['role', 'job', 'profile', 'division', 'company'],
              companyId: request.companyId,
              minScore: rec.inputs.minScore || 0.5,
              limit: rec.inputs.limit || 20
            });

            insights.push({
              type: 'semantic_matches',
              data: matches,
              summary: `Found ${matches.length} semantically relevant items`
            });

            actionsTaken.push({
              tool: rec.tool,
              reason: rec.reason,
              result: { matchCount: matches.length },
              confidence: rec.confidence,
              inputs: rec.inputs,
              timestamp: new Date().toISOString()
            });
            break;
          }

          case 'analyzeStats': {
            const stats = await analyzeStats(
              supabase,
              rec.inputs.entityType,
              rec.inputs.groupBy
            );

            insights.push({
              type: 'statistical_analysis',
              data: stats,
              summary: stats.summary
            });

            actionsTaken.push({
              tool: rec.tool,
              reason: rec.reason,
              result: stats,
              confidence: rec.confidence,
              inputs: rec.inputs,
              timestamp: new Date().toISOString()
            });
            break;
          }

          case 'embedContext': {
            // Store the embedding for future use
            const { data, error } = await supabase
              .from(rec.inputs.entityType)
              .update({ embedding })
              .eq('id', rec.inputs.entityId);

            if (error) throw error;

            actionsTaken.push({
              tool: rec.tool,
              reason: rec.reason,
              result: { success: !error },
              confidence: rec.confidence,
              inputs: rec.inputs,
              timestamp: new Date().toISOString()
            });
            break;
          }

          default:
            console.warn(`Unsupported tool: ${rec.tool}`);
        }
      } catch (error) {
        console.error(`Error executing tool ${rec.tool}:`, error);
        actionsTaken.push({
          tool: rec.tool,
          reason: rec.reason,
          result: { error: error.message },
          confidence: rec.confidence,
          inputs: rec.inputs,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Generate recommendations based on insights
    const recommendations = insights.map(insight => ({
      type: insight.type,
      score: 1.0, // Default score for general insights
      semanticScore: insight.type === 'semantic_matches' ? 1.0 : undefined,
      summary: insight.summary || `Analysis of ${insight.type.replace(/_/g, ' ')}`,
      details: insight.data
    }));

    // Generate chat response using the shared handler
    const chatResponse = await handleChatInteraction(
      supabase,
      request.sessionId,
      request.context.lastMessage,
      {
        mode: 'general',
        actionsTaken,
        candidateContext: {
          matches: insights.find(i => i.type === 'semantic_matches')?.data || [],
          recommendations,
          nextActions: ['refine_analysis', 'explore_specific_area', 'get_detailed_stats']
        }
      }
    );

    // Log completion
    await logProgress(supabase, {
      entityType: 'profile',
      entityId: request.sessionId || undefined,
      stage: 'summary',
      message: `Completed AI-guided analysis with ${insights.length} insights`,
      sessionId: request.sessionId,
      payload: { insights, recommendations }
    });

    return {
      success: true,
      message: 'General analysis completed successfully',
      data: {
        matches: insights.find(i => i.type === 'semantic_matches')?.data as SemanticMatch[],
        recommendations,
        actionsTaken,
        nextActions: ['refine_analysis', 'explore_specific_area', 'get_detailed_stats'],
        chatResponse: {
          message: chatResponse.response,
          followUpQuestion: chatResponse.followUpQuestion
        }
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