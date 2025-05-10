import { encode as gpt4Encode } from 'https://esm.sh/gpt-tokenizer@2.1.2';
import {
  ModelId,
  ModelProfile,
  PromptData,
  PromptOptions,
  PromptResult,
  MODEL_PROFILES
} from './promptTypes.ts';

// Override the placeholder tokenizers with actual implementations
const modelProfiles = {
  ...MODEL_PROFILES,
  'openai:gpt-4-turbo-preview': {
    ...MODEL_PROFILES['openai:gpt-4-turbo-preview'],
    tokenizer: gpt4Encode
  },
  'openai:gpt-3.5-turbo': {
    ...MODEL_PROFILES['openai:gpt-3.5-turbo'],
    tokenizer: gpt4Encode
  },
  'anthropic:claude-3-opus': {
    ...MODEL_PROFILES['anthropic:claude-3-opus'],
    tokenizer: (text: string) => Math.ceil(text.length / 3.5) // Approximate for Claude
  },
  'mistral:mixtral-8x7b': {
    ...MODEL_PROFILES['mistral:mixtral-8x7b'],
    tokenizer: (text: string) => Math.ceil(text.length / 3) // Approximate for Mistral
  }
};

/**
 * Estimate token count for a given text using model-specific tokenizer
 */
function estimateTokens(modelId: ModelId, text: string): number {
  const profile = modelProfiles[modelId];
  if (!profile) {
    throw new Error(`Unknown model: ${modelId}`);
  }
  return profile.tokenizer(text);
}

/**
 * Truncate data to fit within token limits while preserving important information
 */
function truncateData(
  data: Record<string, any>,
  maxTokens: number,
  modelId: ModelId,
  options: PromptOptions = {}
): { data: Record<string, any>; truncated: boolean } {
  const {
    maxItems = 5,
    maxFieldLength = 200,
    priorityFields = [],
    excludeFields = []
  } = options;

  let truncated = false;
  const result = { ...data };

  // Helper to truncate arrays
  const truncateArray = (arr: any[], max: number) => {
    if (arr.length > max) {
      truncated = true;
      return arr.slice(0, max);
    }
    return arr;
  };

  // Helper to truncate text
  const truncateText = (text: string, max: number) => {
    if (text.length > max) {
      truncated = true;
      return text.slice(0, max) + '...';
    }
    return text;
  };

  // Process each field
  for (const [key, value] of Object.entries(result)) {
    if (excludeFields.includes(key)) {
      delete result[key];
      continue;
    }

    if (Array.isArray(value)) {
      result[key] = truncateArray(value, maxItems).map(item => {
        if (typeof item === 'string') {
          return truncateText(item, maxFieldLength);
        }
        if (typeof item === 'object') {
          const { data: truncatedItem } = truncateData(
            item,
            maxTokens / maxItems,
            modelId,
            { ...options, maxItems: 3 }
          );
          return truncatedItem;
        }
        return item;
      });
    } else if (typeof value === 'string') {
      result[key] = truncateText(value, maxFieldLength);
    } else if (typeof value === 'object' && value !== null) {
      const { data: truncatedObj } = truncateData(
        value,
        maxTokens / 2,
        modelId,
        options
      );
      result[key] = truncatedObj;
    }
  }

  return { data: result, truncated };
}

/**
 * Format data according to model preferences
 */
function formatData(
  data: Record<string, any>,
  modelId: ModelId
): string {
  const profile = modelProfiles[modelId];
  
  if (profile.preferredFormat === 'json') {
    const formatted = JSON.stringify(data, null, 2);
    return profile.useDelimiters ? `<json>\n${formatted}\n</json>` : formatted;
  }
  
  // Plaintext format
  return Object.entries(data)
    .map(([key, value]) => {
      if (typeof value === 'object') {
        return `${key.toUpperCase()}:\n${JSON.stringify(value, null, 2)}`;
      }
      return `${key.toUpperCase()}: ${value}`;
    })
    .join('\n\n');
}

/**
 * Build a safe prompt that respects model token limits
 */
export function buildSafePrompt(
  modelId: ModelId,
  promptData: PromptData,
  options: PromptOptions = {}
): PromptResult {
  const profile = modelProfiles[modelId];
  if (!profile) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  const { systemPrompt, userMessage, data, context } = promptData;
  
  // Calculate initial token estimates
  const systemTokens = systemPrompt ? estimateTokens(modelId, systemPrompt) : 0;
  const messageTokens = userMessage ? estimateTokens(modelId, userMessage) : 0;
  const baseTokens = systemTokens + messageTokens;
  
  // Calculate remaining tokens for data
  const availableTokens = profile.maxInputTokens - baseTokens - profile.buffer;
  
  // Prepare data for inclusion
  let formattedData = '';
  let truncated = false;
  let originalDataSize = 0;
  let truncatedDataSize = 0;
  
  if (data) {
    originalDataSize = Object.keys(data).length;
    const { data: truncatedData, truncated: wasDataTruncated } = truncateData(
      data,
      availableTokens,
      modelId,
      options
    );
    truncated = wasDataTruncated;
    truncatedDataSize = Object.keys(truncatedData).length;
    formattedData = formatData(truncatedData, modelId);
  }

  // Build final prompt components
  const system = systemPrompt || '';
  const user = [
    userMessage,
    formattedData,
    context ? formatData(context, modelId) : ''
  ].filter(Boolean).join('\n\n');

  // Final token count
  const totalTokens = estimateTokens(modelId, system + user);

  return {
    system,
    user,
    metadata: {
      tokens: totalTokens,
      truncated,
      provider: profile.provider,
      model: modelId,
      originalDataSize,
      truncatedDataSize
    }
  };
} 