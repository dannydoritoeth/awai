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
  sessionId?: string;
  context?: {
    lastMessage?: string;
    [key: string]: any;
  };
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
}

export interface MCPActionV2 extends MCPActionMetadata {
  actionFn: (ctx: Record<string, any>) => Promise<any>; // replace with better typing if needed
} 