import { ChatMessage } from './chatTypes.ts';
import { AgentAction } from './agent/logAgentAction.ts';

export type MCPMode = 'candidate' | 'hiring' | 'general';

export type EntityType = 'profile' | 'role' | 'job' | 'general' | 'division' | 'company' | 'chat';

export interface SemanticMatch {
  id: string;
  matchId?: string;
  similarity: number;
  type: 'profile' | 'role' | 'skill' | 'capability' | 'company';
  name: string;
  summary?: string;
  metadata?: Record<string, any>;
}

export interface SemanticContext {
  currentFocus?: 'role' | 'skill' | 'capability' | 'company';
  previousMatches?: SemanticMatch[];
  previousFocus?: 'role' | 'job' | 'capability' | 'company';
  matchingTopic?: string;
}

export interface MCPContext {
  lastMessage: string;
  chatHistory?: ChatMessage[];
  agentActions?: AgentAction[];
  contextEmbedding?: number[];
  summary?: string;
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
  companyId?: string;
  mode: MCPMode;
  sessionId?: string;
  context?: MCPContext;
  plannerRecommendations?: PlannerRecommendation[];
}

/**
 * MCP response data
 */
export interface MCPResponse {
  success: boolean;
  message: string;
  data?: {
    matches?: Array<SemanticMatch | HiringMatch>;
    recommendations?: any[];
    chatResponse?: {
      message: string;
      followUpQuestion?: string;
      aiPrompt?: string;
      promptDetails?: any;
    };
    nextActions?: NextAction[];
    actionsTaken?: MCPAction[];
    role?: RoleContext | null;
    profile?: ProfileContext | null;
    insightData?: any;
  };
  error?: {
    type: string;
    message: string;
    details?: any;
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

export interface MatchHistory {
  matchId: string;
  roleId: string;
  profileId: string;
  timestamp: string;
  score: number;
  semanticScore: number;
  status: 'pending' | 'reviewed' | 'rejected' | 'accepted';
}

/**
 * Database response wrapper
 */
export interface DatabaseResponse<T> {
  data: T | null;
  error: {
    type: 'DATABASE_ERROR' | 'INTERNAL_ERROR';
    message: string;
    details?: any;
  } | null;
}

/**
 * Profile context data
 */
export interface ProfileContext {
  profile: {
    id: string;
    name: string;
    email: string;
    embedding: number[];
    skills: Array<{
      id: string;
      name: string;
      category: string;
      level: number;
      years_experience: number;
    }>;
    capabilities: Array<{
      id: string;
      name: string;
      group_name: string;
      level: number;
    }>;
  };
  careerPath: {
    id: string;
    current_role: string;
    target_role: string;
    status: string;
    progress: number;
  } | null;
  jobInteractions: Array<{
    id: string;
    job_id: string;
    status: string;
    applied_date: string;
    feedback: string;
  }>;
}

/**
 * Role context data
 */
export interface RoleContext {
  role: {
    id: string;
    title: string;
    division_id?: string;
    grade_band?: string;
    location?: string;
    primary_purpose?: string;
    reporting_line?: string;
    direct_reports?: string;
    budget_responsibility?: string;
    capabilities: Array<{
      id: string;
      name: string;
      group_name: string;
      level: number;
    }>;
    skills: Array<{
      id: string;
      name: string;
      category: string;
      required_level: number;
      required_years: number;
    }>;
  };
  division: {
    id: string;
    name: string;
    parent_id?: string;
    level?: number;
    head_count?: number;
  } | null;
  openings: Array<{
    id: string;
    status: string;
    start_date?: string;
    priority?: number;
  }>;
}

/**
 * Next action recommendation
 */
export interface NextAction {
  type: string;
  description: string;
  priority?: number;
  metadata?: any;
}

/**
 * Hiring-specific MCP response
 */
export interface HiringMCPResponse extends MCPResponse {
  data: {
    matches: HiringMatch[];
    chatResponse: {
      message: string;
      followUpQuestion?: string;
      aiPrompt?: string;
    };
    nextActions: NextAction[];
    actionsTaken: MCPAction[];
    role: RoleContext | null;
  };
}

/**
 * Hiring match result
 */
export interface HiringMatch {
  profileId: string;
  name: string;
  score: number;
  semanticScore: number;
  details: {
    capabilities: {
      matched: string[];
      missing: string[];
      insufficient: string[];
    };
    skills: {
      matched: string[];
      missing: string[];
      insufficient: string[];
    };
  };
}

/**
 * Candidate-specific MCP response
 */
export interface CandidateMCPResponse extends MCPResponse {
  data: {
    matches: SemanticMatch[];
    recommendations: any[];
    chatResponse: {
      message: string;
      followUpQuestion?: string;
      aiPrompt?: string;
    };
    nextActions: NextAction[];
    actionsTaken: MCPAction[];
    profile: ProfileContext | null;
  };
}

/**
 * Analyst-specific MCP response
 */
export interface AnalystMCPResponse extends MCPResponse {
  data: {
    matches: SemanticMatch[];
    recommendations: any[];
    insightData: any;
    chatResponse: {
      message: string;
      followUpQuestion?: string;
      promptDetails?: any;
    };
    actionsTaken: MCPAction[];
    nextActions: NextAction[];
  };
} 