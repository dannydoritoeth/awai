// Base MCP Response interface that all modes must implement
export interface BaseMCPResponse {
  success: boolean;
  error?: string;
  data: {
    matches: any[]; // Array of matching items (roles, candidates, or general matches)
    recommendations: string[]; // List of recommendations
    chatResponse: {
      message: string;
      followUpQuestion?: string;
    };
    nextActions: string[] | NextAction[]; // List of next possible actions
    actionsTaken: string[]; // List of actions that were taken during processing
  };
}

// Hiring mode specific response
export interface HiringMCPResponse extends BaseMCPResponse {
  data: BaseMCPResponse['data'] & {
    role: {
      id: string;
      title: string;
      description: string;
      requirements: string[];
      // Add other role-specific fields as needed
    };
  };
}

// Candidate mode specific response
export interface CandidateMCPResponse extends BaseMCPResponse {
  data: BaseMCPResponse['data'] & {
    profile: {
      id: string;
      name: string;
      skills: string[];
      experience: string[];
      // Add other profile-specific fields as needed
    };
  };
}

// General mode uses BaseMCPResponse directly
export type GeneralMCPResponse = BaseMCPResponse;

export interface NextAction {
  type: string;
  description: string;
}

export interface ChatResponse {
  message: string;
  followUpQuestion?: string;
}

export interface PlannerRecommendation {
  tool: string;
  reason: string;
  confidence: number;
  inputs: Record<string, any>;
}

export interface AnalystMCPResponse extends BaseMCPResponse {
  data: {
    matches: any[];
    recommendations: string[];
    insightData: any;
    chatResponse: ChatResponse;
    actionsTaken: string[];
    nextActions: NextAction[];
  };
}

// Union type for all possible MCP responses
export type MCPResponse = HiringMCPResponse | CandidateMCPResponse | GeneralMCPResponse | AnalystMCPResponse;

// Helper type guard functions
export const isHiringResponse = (response: MCPResponse): response is HiringMCPResponse => {
  return 'role' in response.data;
};

export const isCandidateResponse = (response: MCPResponse): response is CandidateMCPResponse => {
  return 'profile' in response.data;
};

export const isGeneralResponse = (response: MCPResponse): response is GeneralMCPResponse => {
  return !isHiringResponse(response) && !isCandidateResponse(response);
};

export type MCPMode = 'hiring' | 'candidate' | 'general' | 'analyst'; 