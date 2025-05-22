import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../../database.types.ts';
import { MCPActionV2, MCPResponse } from '../../types/action.ts';
import { logAgentProgress } from '../../../chatUtils.ts';
import { buildSafePrompt } from '../../promptBuilder.ts';
import { invokeChatModel } from '../../../ai/invokeAIModel.ts';

interface InsightResponse {
  response: string;
  followUpQuestion?: string;
}

async function generateCapabilityInsightsBase(
  data: any,
  message?: string
): Promise<InsightResponse> {
  const promptData = {
    systemPrompt: 'You are an AI analyst providing insights on organizational capabilities.',
    userMessage: message || 'Please analyze the capability data and provide insights.',
    data: {
      heatmaps: data
    }
  };

  const prompt = buildSafePrompt('openai:gpt-3.5-turbo', promptData, {
    maxItems: 10,
    maxFieldLength: 200
  });

  const aiResponse = await invokeChatModel(
    {
      system: prompt.system,
      user: prompt.user
    },
    {
      model: 'openai:gpt-3.5-turbo',
      temperature: 0.2
    }
  );

  if (!aiResponse.success) {
    throw new Error(`AI API error: ${aiResponse.error?.message || 'Unknown error'}`);
  }

  const parts = (aiResponse.output || '').split(/\n\nFollow-up question:/i);
  return {
    response: parts[0].trim(),
    followUpQuestion: parts[1]?.trim()
  };
}

export const generateCapabilityInsights: MCPActionV2 = {
  id: 'generateCapabilityInsights',
  title: 'Generate Capability Insights',
  description: 'Creates a high-level AI-generated summary of trends, gaps, and capability strengths from heatmap data.',
  applicableRoles: ['analyst'],
  capabilityTags: ['Insight Generation', 'AI Analysis'],
  requiredInputs: ['heatmapData'],
  tags: ['ai', 'heatmap_analysis', 'strategic'],
  usesAI: true,
  actionFn: async (request): Promise<MCPResponse<InsightResponse>> => {
    const { supabase, heatmapData, message, sessionId } = request;

    if (!heatmapData) {
      return {
        success: false,
        error: {
          type: 'INVALID_INPUT',
          message: 'Heatmap data is required',
          details: null
        }
      };
    }

    try {
      // Log starting analysis
      if (sessionId) {
        await logAgentProgress(
          supabase,
          sessionId,
          "I'm analyzing the capability data to generate insights...",
          { phase: 'insight_generation_start' }
        );
      }

      const insights = await generateCapabilityInsightsBase(heatmapData, message);

      // Log completion
      if (sessionId) {
        await logAgentProgress(
          supabase,
          sessionId,
          insights.response,
          { 
            phase: 'insight_generation_complete',
            followUpQuestion: insights.followUpQuestion
          }
        );
      }

      return {
        success: true,
        data: insights,
        dataForDownstreamPrompt: {
          generateCapabilityInsights: {
            dataSummary: insights.response,
            structured: {
              hasFollowUp: !!insights.followUpQuestion,
              followUpQuestion: insights.followUpQuestion
            },
            truncated: false
          }
        }
      };

    } catch (error) {
      console.error('Error in generateCapabilityInsights:', error);
      
      if (sessionId) {
        await logAgentProgress(
          supabase,
          sessionId,
          "I encountered an error while generating insights.",
          { phase: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
        );
      }

      return {
        success: false,
        error: {
          type: 'INSIGHT_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: error
        }
      };
    }
  },
  getDefaultArgs: (context) => ({
    heatmapData: context.heatmapData,
    message: context.message
  })
}; 