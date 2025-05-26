import { ChatPrompt } from './invokeAIModelV2.ts';

interface ConversationContext {
  pastMessages?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  summary?: string;
}

/**
 * Enhances a prompt with conversation context
 * @param prompt The original prompt
 * @param context The conversation context
 * @returns Enhanced prompt with conversation context
 */
export function enhancePromptWithContext(
  prompt: ChatPrompt,
  context?: ConversationContext
): ChatPrompt {
  if (!context?.pastMessages?.length && !context?.summary) {
    return prompt;
  }

  let enhancedSystem = prompt.system;

  // Add conversation context to system prompt
  if (context.summary) {
    enhancedSystem = `${enhancedSystem}\n\nCONVERSATION CONTEXT:\n${context.summary}`;
  }

  if (context.pastMessages?.length) {
    enhancedSystem += '\n\nRELEVANT CONVERSATION HISTORY:';
    context.pastMessages.forEach(msg => {
      enhancedSystem += `\n${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`;
    });
  }

  return {
    ...prompt,
    system: enhancedSystem
  };
} 