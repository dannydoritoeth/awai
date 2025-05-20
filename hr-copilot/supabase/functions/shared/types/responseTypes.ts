/**
 * Base response data interface
 */
export interface BaseResponseData {
  type: string;
  data: Record<string, any>;
}

/**
 * Response data for regular chat messages
 */
export interface ResponseData extends BaseResponseData {
  type: 'chat' | 'action' | 'insight';
  data: {
    message?: string;
    action?: string;
    result?: any;
    metadata?: Record<string, any>;
  };
}

/**
 * Response data for heatmap requests
 */
export interface HeatmapRequestData extends BaseResponseData {
  type: 'heatmap';
  data: {
    insightId: string;
    mode: string;
    sessionId: string;
    companyIds: string[];
    result?: {
      raw?: any[];
      processed?: Record<string, any>;
    };
  };
} 