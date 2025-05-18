export type ChatSender = 'user' | 'assistant' | 'system';

export interface HeatmapRequestData {
  mode: string;
  context: {
    mode: string;
    scope: string;
    summary: string;
    companyIds: string[];
    chatHistory: any[];
    lastMessage: string;
    agentActions: any[];
    outputFormat: string;
    semanticContext: {
      previousMatches: any[];
    };
    contextEmbedding: any[];
  };
  insightId: string;
  sessionId: string;
  companyIds: string[];
  plannerRecommendations: any[];
}

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
  response_data?: ResponseData | HeatmapRequestData;
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

export interface CapabilityData {
  taxonomy: string;
  capability: string;
  percentage: number;
} 