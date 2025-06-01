import { ActionResultV2, PlannedActionV2 } from '../mcp/types/action.ts';

// Base MCP Response interface that all modes must implement
export interface BaseMCPResponse {
  success: boolean;
  error?: string;
  data?: BaseMCPResponseData;
}

// Hiring mode specific response
export interface HiringMCPResponse extends BaseMCPResponse {
  data?: BaseMCPResponseData & {
    matchingProfiles?: any[];
    roleRequirements?: any;
    fitScores?: any;
  };
}

// Candidate mode specific response
export interface CandidateMCPResponse extends BaseMCPResponse {
  data?: BaseMCPResponseData & {
    careerPaths?: string[];
    skillGaps?: string[];
    developmentPlan?: any;
  };
}

// General mode uses BaseMCPResponse directly
export type GeneralMCPResponse = BaseMCPResponse;

export interface NextAction {
  action: string;
  reason: string;
  confidence: number;
}

export interface ChatResponse {
  message: string;
  followUpQuestion?: string;
  promptDetails?: {
    system: string;
    user: string;
    metadata: any;
  };
}

export interface PlannerRecommendation {
  tool: string;
  reason: string;
  confidence: number;
  inputs: Record<string, any>;
}

export interface AnalystMCPResponse extends BaseMCPResponse {
  data?: BaseMCPResponseData & {
    analysis?: any;
    heatmap?: any;
    trends?: any;
  };
}

export interface BaseMCPResponseData {
    matches: any[];
    recommendations: string[];
  chatResponse: {
    message: string;
    followUpQuestion?: string;
  };
  nextActions: string[] | NextAction[];
    actionsTaken: string[];
  // V2 specific fields
  intermediateResults?: ActionResultV2[];
  context?: Record<string, any>;
  plan?: PlannedActionV2[];
}

// Union type for all possible MCP responses
export type MCPResponse = BaseMCPResponse | CandidateMCPResponse | HiringMCPResponse | AnalystMCPResponse;

// Helper type guard functions
export const isHiringResponse = (response: MCPResponse): response is HiringMCPResponse => {
  return response.data !== undefined && 
    ('matchingProfiles' in response.data || 'roleRequirements' in response.data || 'fitScores' in response.data);
};

export const isCandidateResponse = (response: MCPResponse): response is CandidateMCPResponse => {
  return response.data !== undefined && 
    ('careerPaths' in response.data || 'skillGaps' in response.data || 'developmentPlan' in response.data);
};

export const isGeneralResponse = (response: MCPResponse): response is GeneralMCPResponse => {
  return !isHiringResponse(response) && !isCandidateResponse(response);
};

export type MCPMode = 'hiring' | 'candidate' | 'general' | 'analyst'; 