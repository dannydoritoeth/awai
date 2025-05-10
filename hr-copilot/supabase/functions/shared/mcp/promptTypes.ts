/**
 * Model configuration interface
 */
export interface ModelProfile {
  provider: 'openai' | 'anthropic' | 'google' | 'mistral';
  maxTokens: number;
  maxInputTokens: number;
  buffer: number;
  preferredFormat: 'json' | 'plaintext';
  useDelimiters: boolean;
  tokenizer: (text: string) => number;
}

/**
 * Model ID type
 */
export type ModelId = 
  | 'openai:gpt-4-turbo-preview'
  | 'openai:gpt-3.5-turbo'
  | 'anthropic:claude-3-opus'
  | 'mistral:mixtral-8x7b';

/**
 * Prompt data interface
 */
export interface PromptData {
  systemPrompt?: string;
  userMessage?: string;
  data?: Record<string, any>;
  context?: Record<string, any>;
}

/**
 * Prompt options interface
 */
export interface PromptOptions {
  maxItems?: number;
  maxFieldLength?: number;
  priorityFields?: string[];
  excludeFields?: string[];
}

/**
 * Prompt result interface
 */
export interface PromptResult {
  system: string;
  user: string;
  metadata: {
    tokens: number;
    truncated: boolean;
    provider: string;
    model: string;
    originalDataSize?: number;
    truncatedDataSize?: number;
  };
}

/**
 * Model profiles configuration
 */
export const MODEL_PROFILES: Record<ModelId, ModelProfile> = {
  'openai:gpt-4-turbo-preview': {
    provider: 'openai',
    maxTokens: 128000,
    maxInputTokens: 126000,
    buffer: 2000,
    preferredFormat: 'json',
    useDelimiters: true,
    tokenizer: () => 0 // Placeholder - actual implementation in promptBuilder.ts
  },
  'openai:gpt-3.5-turbo': {
    provider: 'openai',
    maxTokens: 16384,
    maxInputTokens: 15384,
    buffer: 1000,
    preferredFormat: 'json',
    useDelimiters: true,
    tokenizer: () => 0
  },
  'anthropic:claude-3-opus': {
    provider: 'anthropic',
    maxTokens: 200000,
    maxInputTokens: 198000,
    buffer: 2000,
    preferredFormat: 'plaintext',
    useDelimiters: false,
    tokenizer: () => 0
  },
  'mistral:mixtral-8x7b': {
    provider: 'mistral',
    maxTokens: 32768,
    maxInputTokens: 31768,
    buffer: 1000,
    preferredFormat: 'json',
    useDelimiters: true,
    tokenizer: () => 0
  }
}; 