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
      return {
        success: false,
        status: response.status,
        error: {
          type: data?.error?.type || 'OPENAI_ERROR',
          message: data?.error?.message || 'Unexpected error from OpenAI'
        }
      };
    }

    const message = data.choices?.[0]?.message?.content || '';

    return {
      success: true,
      output: message,
      fullResponse: data,
      status: response.status
    };

  } catch (err) {
    return {
      success: false,
      error: {
        type: 'NETWORK_ERROR',
        message: err.message
      }
    };
  }
} 