import { ChatPrompt } from '../../../ai/invokeAIModelV2.ts';

interface BuildPromptParams {
  lastMessage?: string;
  summary?: string;
  agentActions?: Array<{
    id: string;
    type: string;
    summary?: string;
    timestamp?: string;
  }>;
  pastMessages?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export function buildPrompt(params: BuildPromptParams): ChatPrompt {
  const { lastMessage, summary, agentActions = [], pastMessages = [] } = params;

  // Build context from agent actions
  const actionContext = agentActions
    .map(action => `- ${action.type}: ${action.summary || 'No summary available'}`)
    .join('\n');

  // Build system prompt
  const systemPrompt = `You are a helpful AI assistant responding based on the conversation history and previous actions.
Your goal is to provide clear, concise, and relevant responses based on what has been discussed or done so far.

${summary ? `\nSession Summary:\n${summary}` : ''}
${actionContext ? `\nPrevious Actions:\n${actionContext}` : ''}

Guidelines:
1. Be direct and to the point
2. Reference specific details from the history when relevant
3. If you're not sure about something, acknowledge what you do know and what you don't
4. Maintain a helpful and professional tone
5. If the user needs more specific information, suggest what actions or tools might help`;

  // Build user message
  const userMessage = lastMessage || "What can you tell me based on our conversation so far?";

  return {
    system: systemPrompt,
    messages: [
      ...pastMessages,
      { role: 'user', content: userMessage }
    ]
  };
} 