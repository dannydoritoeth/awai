import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js';
import type { Database } from '../../../database.types.ts';

export interface MCPActionMetadata {
  id: string;
  title: string;
  description?: string;
  applicableRoles: string[]; // e.g. ['analyst', 'candidate']
  capabilityTags: string[];  // e.g. ['Workforce Planning', 'Succession']
  requiredInputs: string[];  // e.g. ['profileId', 'roleId']
  tags?: string[];  // e.g. ['gap_analysis', 'tactical', 'strategic']
  recommendedAfter?: string[];  // Actions that should precede this one
  recommendedBefore?: string[];  // Actions that should follow this one
  usesAI?: boolean;  // Whether this action uses AI for processing
}

export interface MCPRequest {
  profileId?: string;
  roleId?: string;
  companyId?: string;
  mode: 'candidate' | 'hiring' | 'analyst' | 'general';
  sessionId: string;
  messages: ChatMessage[];
  context?: {
    lastMessage?: string;
    [key: string]: any;
  };
  plannerRecommendations?: any[];
  availableTools?: ToolMetadata[];
  supabase: any; // Type will be SupabaseClient<Database>
}

export interface MCPError {
  type: string;
  message: string;
  details?: any;
}

export interface MCPAction {
  tool: string;
  reason: string;
  result: 'success' | 'failure';
  confidence: number;
  inputs: Record<string, any>;
  timestamp: string;
}

export interface NextAction {
  type: string;
  description: string;
  priority?: 'high' | 'medium' | 'low';
  context?: Record<string, any>;
}

export interface MCPResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: MCPError;
  actionsTaken?: MCPAction[];
  nextActions?: NextAction[];
  chatResponse?: {
    message: string;
    followUpQuestion?: string;
    aiPrompt?: string;
    promptDetails?: any;
  };

  /**
   * Summarised or truncated data for the current actions
   * that can be safely used in downstream prompt building.
   */
  dataForDownstreamPrompt?: {
    [actionId: string]: {
      dataSummary?: string;         // A short natural language summary
      structured?: any;             // Optional structured version
      truncated?: boolean;          // If trimmed for token limits
    };
  };
}

export interface MCPActionV2 extends MCPActionMetadata {
  actionFn: (ctx: Record<string, any>) => Promise<any>; // replace with better typing if needed
  argsSchema?: any; // Will be replaced with ZodSchema when we add Zod
  getDefaultArgs?: (context: Record<string, any>) => Record<string, any>; // Function to get default arguments for the action with context
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCall?: {
    tool: string;
    args: Record<string, any>;
  };
}

export interface ToolMetadata {
  name: string;
  description: string;
  argsSchema: any; // Will be replaced with ZodSchema when we add Zod
  run: (params: { context: any; args: Record<string, any> }) => Promise<any>;
}

export interface PlannedAction {
  tool: string;
  args: Record<string, any>;
}

export interface ActionResult {
  tool: string;
  input: any;
  output: any;
  success: boolean;
  error?: string;
}

export interface ChatMessageV2 {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: string;
  toolCall?: {
    tool: string;
    args: Record<string, any>;
  };
}

export interface MCPRequestV2 {
  mode: string;
  sessionId?: string;
  profileId?: string;
  roleId?: string;
  messages?: ChatMessageV2[];
  context?: Record<string, any>;
}

export interface ActionResultV2 {
  tool: string;
  input: Record<string, any>;
  output: any;
  success: boolean;
  error?: string;
  dataForDownstreamPrompt?: Record<string, any>;
  reused?: boolean;
}

export interface PlannedActionV2 {
  tool: string;
  args: Record<string, any>;
  reason?: string;
  announcement?: string;
}

export interface MCPResponseV2 {
  success: boolean;
  error?: {
    type: string;
    message: string;
    details?: any;
  };
  data?: {
    context: Record<string, any>;
    intermediateResults: ActionResultV2[];
    plan: PlannedActionV2[];
    semanticMatches?: any[];
    summaryMessage?: string;
    // Base MCP fields
    matches?: any[];
    recommendations?: string[];
    chatResponse?: {
      message: string;
      followUpQuestion?: string;
    };
    nextActions?: string[];
    actionsTaken?: string[];
  };
}

export interface ToolMetadataV2 {
  name: string;
  title: string;
  description: string;
  argsSchema: {
    safeParse: (args: Record<string, any>) => { success: boolean; error?: { issues: string[] } };
  };
  requiredContext?: string[];
  run: (params: { context: Record<string, any>; args: Record<string, any> }) => Promise<any>;
  recommendedAfter?: string[];
  recommendedBefore?: string[];
  applicableRoles: string[];
  capabilityTags: string[];
  requiredInputs: string[];
  tags?: string[];
  usesAI?: boolean;
} 