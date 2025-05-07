import { Database } from '../database.types.ts';

export type ChatSender = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  sessionId: string;
  sender: ChatSender;
  message: string;
  toolCall?: Record<string, any>;
  responseData?: Record<string, any>;
  timestamp: string;
}

export interface ConversationSession {
  id: string;
  profileId: string;
  createdAt: string;
  updatedAt: string;
  summary?: string;
}

export interface ChatHistory {
  session: ConversationSession | null;
  messages: ChatMessage[];
}

export interface StartChatSessionResponse {
  sessionId: string;
  error?: string;
}

export interface PostMessageResponse {
  messageId: string;
  error?: string;
}

export interface AgentResponse {
  message: string;
  actionType?: string;
  toolCall?: Record<string, any>;
  responseData?: Record<string, any>;
}

export interface ChatError {
  type: 'VALIDATION_ERROR' | 'DATABASE_ERROR' | 'AUTH_ERROR' | 'PLANNER_ERROR';
  message: string;
  details?: any;
}

// Database types
export type Tables = Database['public']['Tables'];
export type ConversationSessionsRow = Tables['conversation_sessions']['Row'];
export type ChatMessagesRow = Tables['chat_messages']['Row']; 