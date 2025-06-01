import { MCPActionV2, MCPResponse } from '../../types/action.ts';
import { enhancePromptWithContext } from '../../../ai/enhancePromptWithContext.ts';
import { invokeChatModelV2 } from '../../../ai/invokeAIModelV2.ts';
import { buildPrompt } from './buildPrompt.ts';
import { getSemanticMatches, generateEmbedding } from '../../../semanticSearch.ts';
import type { Tables } from '../../../embeddings.ts';
import { logAgentProgress } from '../../../chatUtils.ts';

export const replyFromMemory: MCPActionV2 = {
  id: 'replyFromMemory',
  title: 'Reply from Memory',
  description: 'Generate a natural-language response using chat history, agent actions, or session summary.',
  applicableRoles: ['candidate', 'manager', 'analyst', 'general'],
  capabilityTags: ['Conversational', 'Contextual Recall', 'User Support'],
  requiredInputs: [], // No structured input required
  tags: ['memory', 'summary', 'conversational', 'guidance'],
  requiredPrerequisites: [],
  suggestedPrerequisites: [],
  usesAI: true,
  actionFn: async (context: Record<string, any>): Promise<MCPResponse> => {
    try {
      // Extract relevant context
      const { 
        sessionId = 'default',
        lastMessage,
        summary,
        agentActions = [],
        pastMessages = [],
        supabase
      } = context;

      // Get semantic matches from agent_actions table
      if (lastMessage) {
        const embedding = await generateEmbedding(lastMessage);
        const semanticMatches = await getSemanticMatches(
          supabase,
          {
            embedding,
            tables: ['agent_actions' as Tables],
            limit: 5,
            minScore: 0.7,
            filters: {
              session_id: sessionId
            }
          }
        );
        
        // Add semantic matches to context
        if (semanticMatches.length > 0) {
          agentActions.push(...semanticMatches);

          // If we have a session ID and there are matches, log the responses
          if (sessionId) {
            for (const match of semanticMatches) {
              if (match.metadata?.response?.chatResponse?.message) {
                await logAgentProgress(
                  supabase,
                  sessionId,
                  match.metadata.response.chatResponse.message,
                  { phase: 'cached_response', source: match.id }
                );
              }
            }
          }
        }
      }

      // Build the prompt with context
      const prompt = buildPrompt({
        lastMessage,
        summary,
        agentActions,
        pastMessages
      });

      // Enhance prompt with conversation context
      const enhancedPrompt = enhancePromptWithContext(prompt, {
        pastMessages,
        summary
      });

      // Generate response using AI
      const aiResponse = await invokeChatModelV2(enhancedPrompt, {
        model: 'openai:gpt-3.5-turbo',
        temperature: 0.7,
        max_tokens: 500,
        supabase,
        sessionId,
        actionType: 'replyFromMemory'
      });

      if (!aiResponse.success || !aiResponse.output) {
        throw new Error(`AI processing failed: ${aiResponse.error?.message || 'Unknown error'}`);
      }

      // Log progress if we have a session
      if (sessionId) {
        await logAgentProgress(
          supabase,
          sessionId,
          aiResponse.output,
          { 
            phase: 'complete',
            analysisDetails: {
              message: aiResponse.output
            }
          }
        );
      }

      // Structure the response
      return {
        success: true,
        data: {
          message: aiResponse.output
        },
        chatResponse: {
          message: aiResponse.output,
          followUpQuestion: "Is there anything specific you'd like to know more about?"
        }
      };

    } catch (error) {
      console.error('Error in replyFromMemory:', error);
      return {
        success: false,
        error: {
          type: 'REPLY_FROM_MEMORY_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: error
        }
      };
    }
  }
}; 