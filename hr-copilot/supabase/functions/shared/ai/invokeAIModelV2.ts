import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { ModelId } from '../mcp/promptTypes.ts';

export interface ChatPrompt {
  system: string;
  user: string;
  messages?: { role: 'system' | 'user' | 'assistant', content: string }[];
}

export interface AIResponse {
  success: boolean;
  output?: string;
  fullResponse?: any;
  status?: number;
  error?: {
    type: string;
    message: string;
  };
}

interface AIModelInvocation {
  session_id: string;
  action_type?: string;
  model_provider: 'openai' | 'google' | 'anthropic';
  model_name: string;
  temperature?: number;
  max_tokens?: number;
  system_prompt: string;
  user_prompt: string;
  messages?: any[];
  other_params?: Record<string, any>;
  response_text?: string;
  response_metadata?: any;
  token_usage?: any;
  status: 'success' | 'error' | 'timeout';
  error_message?: string;
  latency_ms: number;
}

/**
 * Enhanced version of invokeChatModel that logs to ai_model_invocations table
 */
export async function invokeChatModelV2(
  prompt: ChatPrompt,
  options: {
    model: ModelId;
    temperature?: number;
    max_tokens?: number;
    supabase: SupabaseClient<Database>;
    sessionId: string;
    actionType?: string;
  }
): Promise<AIResponse> {
  const startTime = Date.now();
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

  // Parse model ID to get provider and model name
  const [provider, modelName] = options.model.split(':');
  if (!provider || !modelName) {
    return {
      success: false,
      error: {
        type: 'CONFIG_ERROR',
        message: 'Invalid model ID format'
      }
    };
  }

  const payload = {
    model: modelName,
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
    const endTime = Date.now();
    const latencyMs = endTime - startTime;

    if (!response.ok) {
      const error = {
        success: false,
        status: response.status,
        error: {
          type: data?.error?.type || 'OPENAI_ERROR',
          message: data?.error?.message || 'Unexpected error from OpenAI'
        }
      };

      // Log error to ai_model_invocations
      await logModelInvocation(options.supabase, {
        session_id: options.sessionId,
        action_type: options.actionType,
        model_provider: provider as 'openai',
        model_name: modelName,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
        system_prompt: prompt.system,
        user_prompt: prompt.user,
        messages: prompt.messages,
        status: 'error',
        error_message: error.error.message,
        latency_ms: latencyMs,
        response_metadata: data
      });

      return error;
    }

    const message = data.choices?.[0]?.message?.content || '';

    // Log successful response to ai_model_invocations
    await logModelInvocation(options.supabase, {
      session_id: options.sessionId,
      action_type: options.actionType,
      model_provider: provider as 'openai',
      model_name: modelName,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      system_prompt: prompt.system,
      user_prompt: prompt.user,
      messages: prompt.messages,
      response_text: message,
      response_metadata: data,
      token_usage: data.usage,
      status: 'success',
      latency_ms: latencyMs
    });

    return {
      success: true,
      output: message,
      fullResponse: data,
      status: response.status
    };

  } catch (err) {
    const endTime = Date.now();
    const error = {
      success: false,
      error: {
        type: 'NETWORK_ERROR',
        message: err.message
      }
    };

    // Log error to ai_model_invocations
    await logModelInvocation(options.supabase, {
      session_id: options.sessionId,
      action_type: options.actionType,
      model_provider: provider as 'openai',
      model_name: modelName,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      system_prompt: prompt.system,
      user_prompt: prompt.user,
      messages: prompt.messages,
      status: 'error',
      error_message: err.message,
      latency_ms: endTime - startTime
    });

    return error;
  }
}

/**
 * Helper function to log model invocations to the database
 */
async function logModelInvocation(
  supabase: SupabaseClient<Database>,
  invocation: AIModelInvocation
): Promise<void> {
  try {
    const { error } = await supabase
      .from('ai_model_invocations')
      .insert(invocation);

    if (error) {
      console.error('Failed to log AI model invocation:', error);
    }
  } catch (err) {
    console.error('Error logging AI model invocation:', err);
  }
} 