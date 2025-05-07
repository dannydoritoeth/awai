import { ChatMessage } from './chatTypes.ts';

export type MCPMode = 'candidate' | 'hiring';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface SemanticMatch {
  id: string;
  similarity: number;
  type: 'role' | 'skill' | 'capability' | 'company';
  name: string;
  metadata?: Record<string, any>;
}

export interface SemanticContext {
  currentFocus?: 'role' | 'skill' | 'capability' | 'company';
  previousMatches?: SemanticMatch[];
}

export interface MCPContext {
  lastMessage?: string;
  chatHistory?: ChatMessage[];
  semanticContext?: SemanticContext;
}

export interface PlannerRecommendation {
  tool: string;
  reason: string;
  confidence: number;
  inputs: Record<string, any>;
}

export interface MCPAction {
  tool: string;
  reason: string;
  result: any;
  confidence: number;
  inputs: Record<string, any>;
  timestamp: string;
}

export interface MCPRequest {
  profileId?: string;
  roleId?: string;
  mode: MCPMode;
  sessionId?: string;
  context?: MCPContext;
  plannerRecommendations?: PlannerRecommendation[];
}

export interface MCPResponse {
  success: boolean;
  message?: string;
  error?: {
    type: string;
    message: string;
    details?: any;
  };
  data?: {
    matches?: SemanticMatch[];
    recommendations?: any[];
    nextActions?: string[];
    actionsTaken?: MCPAction[];
    chatResponse?: any;
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