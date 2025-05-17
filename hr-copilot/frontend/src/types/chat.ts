export type ChatSender = 'user' | 'assistant' | 'system';

export interface ResponseData {
  followUpQuestion?: string;
  semanticContext?: {
    relevantText?: string;
    confidence?: number;
  };
  [key: string]: unknown;
}

export interface ChatMessage {
  id: string;
  sessionId?: string;
  sender: 'user' | 'assistant';
  message: string;
  timestamp: string;
  toolCall?: {
    name: string;
    arguments: Record<string, unknown>;
  };
  responseData?: ResponseData;
  followUpQuestion?: string;
  semanticContext?: {
    relevantText?: string;
    confidence?: number;
  };
}

export interface ChatSession {
  id: string;
  mode: 'general' | 'hiring' | 'candidate' | 'analyst';
  entityId?: string;
  status: 'active' | 'completed' | 'error';
  createdAt: string;
  updatedAt: string;
  summary?: string;
  title?: string;
}

export interface ChatError {
  type: 'DATABASE_ERROR' | 'VALIDATION_ERROR' | 'PROCESSING_ERROR' | 'INTERNAL_ERROR';
  message: string;
  details?: unknown;
} 