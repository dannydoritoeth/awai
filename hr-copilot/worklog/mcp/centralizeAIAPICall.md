# 🔁 Work Request: Centralize OpenAI API Call Logic

## Objective

Refactor all direct `fetch()` calls to AI’s `/v1/chat/completions` & embeddings endpoints into a shared utility to ensure consistency, logging, and future configurability across all MCP modules and edge functions.

The goal is that it should be possible to switching out at a single point:
 - the model eg. turbo
 - the provider eg. openai / google
 - the embedding model

---

## 📦 Deliverables

### 1. Create a Shared Utility

**New file**: `shared/ai/invokeAIModel.ts`

```ts
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
  options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  }
): Promise<AIResponse> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');

  const payload = {
    model: options?.model || 'gpt-4-turbo-preview',
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

//Something similar for getting the embeddings
//export async function invokeEmbedding(