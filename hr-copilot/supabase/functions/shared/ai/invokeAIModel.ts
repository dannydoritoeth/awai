import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { logAgentAction } from '../agent/logAgentAction.ts';
import type { ModelId } from '../mcp/promptTypes.ts';

interface ChatPrompt {
  system: string;
  user: string;
  messages?: { role: 'system' | 'user' | 'assistant', content: string }[];
}

interface AIResponse {
  success: boolean;
  output?: string;
  fullResponse?: any;
  status?: number;
  error?: {
    type: string;
    message: string;
  };
}

export async function invokeChatModel(
  prompt: ChatPrompt,
  options: {
    model: ModelId;
    temperature?: number;
    max_tokens?: number;
    supabase?: SupabaseClient<Database>;
    entityType?: 'profile' | 'role' | 'job' | 'company' | 'division' | 'chat';
    entityId?: string;
  }
): Promise<AIResponse> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return {
      success: false,
      error: {
        type: 'CONFIG_ERROR',
        message: 'OpenAI API key not found'
      }
    };
  }

  // Extract the actual model name from the ModelId format (provider:model-name)
  const actualModel = options.model.split(':')[1];

  const payload = {
    model: actualModel,
    messages: prompt.messages || [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user }
    ],
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.max_tokens ?? 1000
  };

  try {
    console.log('Calling OpenAI chat model...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      const error = {
        success: false,
        status: response.status,
        error: {
          type: data?.error?.type || 'OPENAI_ERROR',
          message: data?.error?.message || 'Unexpected error from OpenAI'
        }
      };

      // Log error if supabase client is provided
      if (options.supabase && options.entityType && options.entityId) {
        await logAgentAction(options.supabase, {
          entityType: options.entityType,
          entityId: options.entityId,
          payload: {
            action: 'ai_model_invocation',
            status: 'error',
            model: actualModel,
            prompt: {
              system: prompt.system,
              user: prompt.user
            },
            error: error.error
          }
        });
      }

      return error;
    }

    const message = data.choices?.[0]?.message?.content || '';

    // Log successful response if supabase client is provided
    if (options.supabase && options.entityType && options.entityId) {
      await logAgentAction(options.supabase, {
        entityType: options.entityType,
        entityId: options.entityId,
        payload: {
          action: 'ai_model_invocation',
          status: 'success',
          model: actualModel,
          prompt: {
            system: prompt.system,
            user: prompt.user
          },
          response: {
            message,
            usage: data.usage
          }
        }
      });
    }

    return {
      success: true,
      output: message,
      fullResponse: data,
      status: response.status
    };

  } catch (err) {
    const error = {
      success: false,
      error: {
        type: 'NETWORK_ERROR',
        message: err.message
      }
    };

    // Log error if supabase client is provided
    if (options.supabase && options.entityType && options.entityId) {
      await logAgentAction(options.supabase, {
        entityType: options.entityType,
        entityId: options.entityId,
        payload: {
          action: 'ai_model_invocation',
          status: 'error',
          model: actualModel,
          prompt: {
            system: prompt.system,
            user: prompt.user
          },
          error: error.error
        }
      });
    }

    return error;
  }
} 