/**
 * Core types for AI interactions in the MCP system
 */

/**
 * Standard input format for AI prompts
 */
export interface AIPromptInput {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Standard output format from AI responses
 */
export interface AIResponse<T = any> {
  success: boolean;
  output?: T;
  error?: {
    message: string;
    details?: any;
  };
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: {
    model: string;
    temperature: number;
    maxTokens: number;
  };
}

/**
 * Configuration for prompt safety checks
 */
export interface SafePromptConfig {
  maxLength?: number;
  maxItems?: number;
  maxFieldLength?: number;
  priorityFields?: string[];
  excludeFields?: string[];
}

/**
 * Validated and sanitized prompt
 */
export interface SafePrompt {
  system: string;
  user: string;
  config?: SafePromptConfig;
} 