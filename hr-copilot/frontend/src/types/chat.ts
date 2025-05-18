export type ChatSender = 'user' | 'assistant' | 'system';

export interface HeatmapRequestData {
  mode: string;
  insightId: string;
  sessionId: string;
  companyIds: string[];
}

export interface ResponseData {
  matches?: Match[];
  raw?: unknown[];
  summarized?: {
    csv_data?: string;
    summary?: unknown;
  };
  error?: string | null;
}

export interface ChatMessage {
  id: string;
  message: string;
  sender: 'user' | 'assistant';
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

export interface Match {
  name: string;
  match_percentage: number;
  match_status?: string;
} 