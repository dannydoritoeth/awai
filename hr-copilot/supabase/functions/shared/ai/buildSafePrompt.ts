import { AIPromptInput, SafePromptConfig, SafePrompt } from './types.ts';

const DEFAULT_CONFIG: SafePromptConfig = {
  maxLength: 4000,
  maxItems: 50,
  maxFieldLength: 500,
  priorityFields: ['name', 'title', 'summary', 'description'],
  excludeFields: ['metadata', 'raw_data', 'embedding']
};

/**
 * Validates and sanitizes a prompt to ensure it meets safety requirements
 * @param prompt The raw prompt input
 * @param config Optional configuration to override defaults
 * @returns A safe, validated prompt
 */
export function buildSafePrompt(
  prompt: AIPromptInput,
  config: Partial<SafePromptConfig> = {}
): SafePrompt {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const maxLength = finalConfig.maxLength || DEFAULT_CONFIG.maxLength || 4000;

  // Validate prompt structure
  if (!prompt.system || !prompt.user) {
    throw new Error('Prompt must include both system and user messages');
  }

  // Truncate if needed
  let system = truncateText(prompt.system, maxLength);
  let user = truncateText(prompt.user, maxLength);

  // Remove any potential prompt injection patterns
  system = sanitizeText(system);
  user = sanitizeText(user);

  return {
    system,
    user,
    config: finalConfig
  };
}

/**
 * Truncates text to a maximum length while trying to preserve complete sentences
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  // Try to truncate at sentence boundary
  const truncated = text.slice(0, maxLength);
  const lastSentence = truncated.match(/.*[.!?]/);
  
  if (lastSentence) {
    return lastSentence[0];
  }

  // If no sentence boundary found, truncate at last complete word
  const lastSpace = truncated.lastIndexOf(' ');
  return truncated.slice(0, lastSpace) + '...';
}

/**
 * Removes potential prompt injection patterns and unsafe characters
 */
function sanitizeText(text: string): string {
  return text
    // Remove potential system message overrides
    .replace(/^system:/gi, '')
    .replace(/^assistant:/gi, '')
    // Remove potential JSON/code injection
    .replace(/```[^`]*```/g, '')
    // Remove excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    // Remove unsafe characters
    .replace(/[^\x20-\x7E\n]/g, '')
    .trim();
} 