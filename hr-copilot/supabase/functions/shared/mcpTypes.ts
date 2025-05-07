import { ChatMessage } from './chatTypes';

export type MCPMode = 'candidate' | 'hiring';

export type FocusArea = 'role' | 'skill' | 'capability' | 'company';

export interface SemanticMatch {
  id: string;
  similarity: number;
  type: FocusArea;
  metadata?: Record<string, any>;
}

export interface MCPContext {
  lastMessage?: string;
  chatHistory?: ChatMessage[];
  semanticContext?: {
    currentFocus?: FocusArea;
    previousMatches?: SemanticMatch[];
  };
}

export interface MCPRequest {
  profileId?: string;
  roleId?: string;
  mode: MCPMode;
  sessionId?: string;
  context?: MCPContext;
}

export interface MCPResponse {
  success: boolean;
  message: string;
  data?: {
    matches?: SemanticMatch[];
    recommendations?: any[];
    nextActions?: string[];
  };
  error?: {
    type: 'VALIDATION_ERROR' | 'DATABASE_ERROR' | 'AUTH_ERROR' | 'PLANNER_ERROR';
    message: string;
    details?: any;
  };
}

export interface MCPAction {
  type: string;
  payload: Record<string, any>;
  context: MCPContext;
  semanticMetrics?: {
    confidence: number;
    relevance: number;
    matches: SemanticMatch[];
  };
}

export interface MCPState {
  mode: MCPMode;
  profileId?: string;
  roleId?: string;
  sessionId?: string;
  context: MCPContext;
  lastAction?: MCPAction;
  history: MCPAction[];
} 