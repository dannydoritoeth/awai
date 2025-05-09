// Base MCP Response interface that all modes must implement
export interface BaseMCPResponse {
  success: boolean;
  data: {
    matches: any[]; // Array of matching items (roles, candidates, or general matches)
    recommendations: string[]; // List of recommendations
    chatResponse: {
      message: string;
      followUpQuestion?: string;
    };
    nextActions: string[]; // List of next possible actions
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

// Union type for all possible MCP responses
export type MCPResponse = HiringMCPResponse | CandidateMCPResponse | GeneralMCPResponse;

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