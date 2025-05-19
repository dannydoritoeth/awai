import { SemanticMatch } from '../../../mcpTypes.ts';
import { buildSafePrompt } from '../../promptBuilder.ts';
import { readPrompt } from '../../prompts/readPrompt.ts';
import { invokeChatModel } from '../../../ai/invokeAIModel.ts';

export interface AnalystInsightsResponse {
  response: string;
  followUpQuestion?: string;
  prompt: string;
}

/**
 * Generate analyst insights using ChatGPT
 */
export async function generateAnalystInsights(
  matches: SemanticMatch[],
  recommendations: any[],
  profileData: any,
  message?: string
): Promise<AnalystInsightsResponse> {
  try {
    if (!matches || matches.length === 0) {
      return {
        response: "No matching opportunities found to analyze.",
        followUpQuestion: "Would you like to adjust the search criteria?",
        prompt: "No matches to analyze"
      };
    }

    const promptTemplate = await readPrompt('analyst/generateInsights.txt');
    
    const promptData = {
      systemPrompt: promptTemplate,
      userMessage: message || 'Please analyze the opportunities and provide insights.',
      data: {
        dataOverview: {
          profile: profileData,
          matches: matches.slice(0, 5),
          recommendations: recommendations.slice(0, 5)
        },
        analysisContext: {
          sections: [
            'DATA OVERVIEW',
            'ANALYSIS FINDINGS',
            'TREND ANALYSIS',
            'RECOMMENDATIONS',
            'NEXT STEPS'
          ]
        },
        keyMetrics: {
          totalMatches: matches.length,
          topMatches: matches.slice(0, 3).map(m => ({
            name: m.name,
            score: m.similarity
          }))
        }
      }
    };

    const promptOptions = {
      maxItems: 5,
      maxFieldLength: 200,
      priorityFields: ['name', 'title', 'summary', 'score', 'semanticScore'],
      excludeFields: ['metadata', 'raw_data', 'embedding']
    };

    const prompt = buildSafePrompt('openai:gpt-3.5-turbo', promptData, promptOptions);

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

    const chatResponse = aiResponse.output || '';

    // Split response into main content and follow-up question
    const parts = chatResponse.split(/\n\nFollow-up question:/i);
    return {
      response: parts[0].trim(),
      followUpQuestion: parts[1]?.trim(),
      prompt: prompt.user
    };

  } catch (error) {
    console.error('Error generating analyst insights:', error);
    return {
      response: 'I encountered an error while analyzing the data. Please try again or contact support if the issue persists.',
      followUpQuestion: 'Would you like me to focus on specific aspects of the analysis?',
      prompt: 'Error occurred while generating prompt'
    };
  }
} 