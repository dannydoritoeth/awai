import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Configuration, OpenAIApi } from 'https://esm.sh/openai@3.2.1';
import { Database } from '../../../database.types.ts';
import { logAgentAction } from '../../agent/logAgentAction.ts';
import { ModelId } from '../promptTypes.ts';

// Deno type declaration
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// Initialize OpenAI client
const configuration = new Configuration({
  apiKey: Deno.env.get('OPENAI_API_KEY')
});
const openai = new OpenAIApi(configuration);

interface AICallConfig {
  temperature?: number;
  maxTokens?: number;
  sessionId?: string;
  modelId?: ModelId;
  actionType?: string;
  metadata?: Record<string, any>;
}

interface AICallResult {
  response: string;
  metadata: {
    model: string;
    tokens: number;
    temperature: number;
    truncated: boolean;
  };
}

/**
 * Centralized function for making AI calls with consistent logging
 */
export async function callAI(
  supabase: ReturnType<typeof createClient<Database>>,
  prompt: string,
  config: AICallConfig = {}
): Promise<AICallResult> {
  const {
    temperature = 0.3,
    maxTokens = 1024,
    sessionId = `chat_${Date.now()}`,
    modelId = 'openai:gpt-3.5-turbo',
    actionType = 'general',
    metadata = {}
  } = config;

  // Log the prompt being sent
  await logAgentAction(supabase, {
    entityType: 'chat',
    entityId: sessionId,
    payload: {
      stage: 'ai_prompt',
      message: prompt,
      metadata: {
        model: modelId,
        temperature,
        maxTokens,
        actionType,
        timestamp: new Date().toISOString(),
        ...metadata
      }
    }
  });

  // Make the AI call
  const completion = await openai.createCompletion({
    model: modelId.split(':')[1],
    prompt,
    temperature,
    max_tokens: maxTokens
  });

  const response = completion.data.choices[0]?.text?.trim() || '';
  const responseMetadata = {
    model: modelId,
    tokens: completion.data.usage?.total_tokens || 0,
    temperature,
    truncated: false
  };

  // Log the AI response
  await logAgentAction(supabase, {
    entityType: 'chat',
    entityId: sessionId,
    payload: {
      stage: 'ai_response',
      message: response,
      metadata: {
        ...responseMetadata,
        actionType,
        timestamp: new Date().toISOString(),
        ...metadata
      }
    }
  });

  return {
    response,
    metadata: responseMetadata
  };
} 