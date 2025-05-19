import { PROMPT_CONFIGS } from '../promptConfigs.ts';

// Deno type declaration
declare const Deno: {
  readTextFile(path: string): Promise<string>;
};

/**
 * Load a prompt from either configurations or file
 */
export async function loadPrompt(
  promptType: keyof typeof PROMPT_CONFIGS | string,
  data?: Record<string, any>
): Promise<{ systemPrompt: string; userMessage: string }> {
  let systemPrompt = '';
  let userMessage = '';

  // Try loading from configs first
  if (promptType in PROMPT_CONFIGS) {
    const config = PROMPT_CONFIGS[promptType as keyof typeof PROMPT_CONFIGS];
    systemPrompt = config.promptData.systemPrompt || '';
    userMessage = config.promptData.userMessage || '';
  } else {
    // Try loading from file
    try {
      const promptPath = `./prompts/${promptType}.txt`;
      const content = await Deno.readTextFile(promptPath);
      
      // Split content into system prompt and user message
      const parts = content.split('\n\n');
      systemPrompt = parts[0] || '';
      userMessage = parts.slice(1).join('\n\n') || '';
    } catch (error) {
      throw new Error(`Failed to load prompt: ${promptType}\n${error.message}`);
    }
  }

  // Replace any template variables in the prompts
  if (data) {
    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{{${key}}}`;
      systemPrompt = systemPrompt.replace(new RegExp(placeholder, 'g'), String(value));
      userMessage = userMessage.replace(new RegExp(placeholder, 'g'), String(value));
    }
  }

  return {
    systemPrompt,
    userMessage
  };
}

/**
 * Get the options for a prompt type from configurations
 */
export function getPromptOptions(promptType: keyof typeof PROMPT_CONFIGS) {
  const config = PROMPT_CONFIGS[promptType];
  if (!config) {
    throw new Error(`Unknown prompt type: ${promptType}`);
  }
  return config.options;
} 