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
 * Valid model IDs for AI services
 */
export type ModelId = 
  | 'openai:gpt-3.5-turbo'
  | 'openai:gpt-4'
  | 'anthropic:claude-2'
  | 'azure:gpt-4';

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
 * Result from prompt building
 */
export interface PromptResult {
  system: string;
  user: string;
  metadata?: {
    sections?: string[];
    itemCount?: number;
    truncated?: boolean;
  };
}

/**
 * Configuration for prompt building
 */
export interface PromptConfig {
  maxItems?: number;
  maxFieldLength?: number;
  priorityFields?: string[];
  excludeFields?: string[];
  format?: 'json' | 'markdown' | 'csv';
}

/**
 * Data context for prompt building
 */
export interface PromptContext {
  type?: string;
  format?: 'json' | 'markdown' | 'csv';
  userQuestion?: string;
  sections?: string[];
  metadata?: Record<string, any>;
}

/**
 * Input for prompt building
 */
export interface PromptInput {
  systemPrompt: string;
  data: any;
  context?: PromptContext;
  config?: PromptConfig;
}

/**
 * Error from prompt building
 */
export interface PromptError {
  type: 'VALIDATION_ERROR' | 'PROCESSING_ERROR';
  message: string;
  details?: any;
}

/**
 * Model profiles configuration
 */
export const MODEL_PROFILES: Record<ModelId, ModelProfile> = {
  'openai:gpt-4': {
    provider: 'openai',
    maxTokens: 8192,
    maxInputTokens: 6000,
    buffer: 500,
    preferredFormat: 'json',
    useDelimiters: true,
    tokenizer: () => 0 // Placeholder - actual implementation in promptBuilder.ts
  },
  'openai:gpt-3.5-turbo': {
    provider: 'openai',
    maxTokens: 16384,
    maxInputTokens: 13384,
    buffer: 1000,
    preferredFormat: 'json',
    useDelimiters: true,
    tokenizer: () => 0
  },
  'anthropic:claude-2': {
    provider: 'anthropic',
    maxTokens: 200000,
    maxInputTokens: 198000,
    buffer: 2000,
    preferredFormat: 'plaintext',
    useDelimiters: false,
    tokenizer: () => 0
  },
  'azure:gpt-4': {
    provider: 'openai',
    maxTokens: 32768,
    maxInputTokens: 31768,
    buffer: 1000,
    preferredFormat: 'json',
    useDelimiters: true,
    tokenizer: () => 0
  }
}; 