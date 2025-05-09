// @deno-types="https://esm.sh/v128/@supabase/supabase-js@2.7.1/dist/module/index.d.ts"
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { MCPRequest, MCPResponse, MCPAction, SemanticMatch, EntityType } from '../mcpTypes.ts';
import { logProgress } from '../chatUtils.ts';
import { getSemanticMatches } from '../semanticSearch.ts';
import { generateEmbedding } from '../semanticSearch.ts';
import { getPlannerRecommendation } from './planner.ts';
import { handleChatInteraction } from '../chatUtils.ts';

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

    console.log('Semantic matches found:', {
      count: matches.length,
      types: matches.reduce((acc, m) => {
        acc[m.type] = (acc[m.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      matches: matches.map(m => ({
        id: m.id,
        type: m.type,
        name: m.name,
        similarity: m.similarity
      }))
    });

    // Generate chat response
    const chatResponse = await handleChatInteraction(
      supabase,
      request.sessionId,
      request.context.lastMessage,
      {
        mode: 'general',
        actionsTaken: [{
          tool: 'getSemanticMatches',
          reason: 'Finding relevant roles and jobs',
          result: { 
            matchCount: matches.length,
            matchTypes: matches.reduce((acc, m) => {
              acc[m.type] = (acc[m.type] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          },
          metadata: {
            timestamp: new Date().toISOString()
          }
        } as ActionResult],
        candidateContext: {
          matches,
          recommendations: matches.map(match => ({
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
          }))
        }
      }
    );

    return {
      success: true,
      message: 'General analysis completed successfully',
      data: {
        matches,
        recommendations: matches.map(match => ({
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
        })),
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