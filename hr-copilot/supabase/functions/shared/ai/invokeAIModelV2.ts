import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { ModelId } from '../mcp/promptTypes.ts';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type ChatPrompt = {
  system: string;
} & (
  | { user: string }
  | { messages: ChatMessage[] }
);

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

interface InvokeOptions {
  model?: ModelId;
  temperature?: number;
  max_tokens?: number;
  supabase?: SupabaseClient;
  sessionId?: string;
  actionType?: string;
}

interface ModelInvocationLog {
  session_id: string;
  action_type?: string;
  model_provider: 'openai';
  model_name: string;
  temperature?: number;
  max_tokens?: number;
  system_prompt: string;
  messages: ChatMessage[];
  status: 'success' | 'error';
  error_message?: string;
  response_text?: string;
  response_metadata?: any;
  latency_ms: number;
}

/**
 * Converts a ChatPrompt to OpenAI's message format
 */
function convertToOpenAIMessages(prompt: ChatPrompt): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: 'system', content: prompt.system }
  ];

  if ('user' in prompt) {
    messages.push({ role: 'user', content: prompt.user });
  } else if ('messages' in prompt) {
    messages.push(...prompt.messages);
  }

  return messages;
}

/**
 * Enhanced version of invokeChatModel that logs to ai_model_invocations table
 */
export async function invokeChatModelV2(
  prompt: ChatPrompt,
  options: InvokeOptions = {}
): Promise<AIResponse> {
  const {
    model = 'openai:gpt-3.5-turbo',
    temperature = 0.7,
    max_tokens = 1000,
    supabase,
    sessionId,
    actionType
  } = options;

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
  const [provider, modelName] = model.split(':');
  if (!provider || !modelName) {
    return {
      success: false,
      error: {
        type: 'CONFIG_ERROR',
        message: 'Invalid model ID format'
      }
    };
  }

  try {
    const messages = convertToOpenAIMessages(prompt);

    // Log prompt if supabase client provided
    if (supabase && sessionId) {
      await supabase.from('agent_actions').insert({
        agent_name: 'ai_model',
        action_type: actionType || 'chat',
        session_id: sessionId,
        request: { prompt, options },
        outcome: 'pending'
      });
    }

    console.log('Calling OpenAI chat model...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        temperature,
        max_tokens
      })
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
      await logModelInvocation(supabase, {
        session_id: sessionId,
        action_type: actionType,
        model_provider: provider as 'openai',
        model_name: modelName,
        temperature,
        max_tokens,
        system_prompt: prompt.system,
        user_prompt: prompt.user,
        messages,
        status: 'error',
        error_message: error.error.message,
        latency_ms: latencyMs,
        response_metadata: data
      });

      // Log error to ai_model_invocations
      if (supabase && sessionId) {
        await supabase.from('agent_actions').update({
          response,
          outcome: response.success ? 'success' : 'error'
        }).eq('session_id', sessionId).eq('action_type', actionType || 'chat');
      }

      return error;
    }

    const message = data.choices?.[0]?.message?.content || '';

    // Log successful response to ai_model_invocations
    await logModelInvocation(supabase, {
      session_id: sessionId,
      action_type: actionType,
      model_provider: provider as 'openai',
      model_name: modelName,
      temperature,
      max_tokens,
      system_prompt: prompt.system,
      user_prompt: prompt.user,
      messages,
      response_text: message,
      response_metadata: data,
      token_usage: data.usage,
      status: 'success',
      latency_ms: latencyMs
    });

    // Log response if supabase client provided
    if (supabase && sessionId) {
      await supabase.from('agent_actions').update({
        response,
        outcome: response.success ? 'success' : 'error'
      }).eq('session_id', sessionId).eq('action_type', actionType || 'chat');
    }

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
    await logModelInvocation(supabase, {
      session_id: sessionId,
      action_type: actionType,
      model_provider: provider as 'openai',
      model_name: modelName,
      temperature,
      max_tokens,
      system_prompt: prompt.system,
      user_prompt: prompt.user,
      messages,
      status: 'error',
      error_message: err.message,
      latency_ms: endTime - startTime
    });

    // Log error to ai_model_invocations
    if (supabase && sessionId) {
      await supabase.from('agent_actions').update({
        response: error,
        outcome: 'error'
      }).eq('session_id', sessionId).eq('action_type', actionType || 'chat');
    }

    return error;
  }
}

/**
 * Helper function to log model invocations to the database
 */
async function logModelInvocation(
  supabase: SupabaseClient | undefined,
  log: ModelInvocationLog
): Promise<void> {
  if (!supabase) return;

  try {
    await supabase.from('ai_model_invocations').insert(log);
  } catch (error) {
    console.error('Failed to log model invocation:', error);
  }
} 