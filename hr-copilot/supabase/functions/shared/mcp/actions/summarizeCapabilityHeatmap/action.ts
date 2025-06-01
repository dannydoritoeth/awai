import { MCPActionV2, MCPResponse } from '../../../types/action.ts';
import { summarizeHeatmapData } from '../utils.ts';

interface SummarizedHeatmapData {
  csv_data: string;
  summary: {
    total_roles: number;
    total_capabilities: number;
    total_groups: number;
    matrix_dimensions: {
      rows: number;
      columns: number;
    };
    groups: Array<{
      name: string;
      total_roles: number;
      unique_capabilities: number;
      top_capabilities: Array<{
        name: string;
        count: number;
        percentage: string;
      }>;
    }>;
  };
}

export const summarizeCapabilityHeatmap: MCPActionV2 = {
  id: 'summarizeCapabilityHeatmap',
  title: 'Summarize Capability Heatmap',
  description: 'Converts capability heatmap data into matrix and summary statistics for prompt-building.',
  applicableRoles: ['analyst'],
  capabilityTags: ['Data Summary', 'Token Optimization'],
  requiredInputs: ['heatmapData'],
  tags: ['summary', 'pre-ai'],
  usesAI: false,
  actionFn: async (request): Promise<MCPResponse<SummarizedHeatmapData>> => {
    const { heatmapData } = request;

    if (!heatmapData || !Array.isArray(heatmapData)) {
      return {
        success: false,
        error: {
          type: 'INVALID_INPUT',
          message: 'Valid heatmap data array is required',
          details: null
        }
      };
    }

    try {
      const summarizedData = summarizeHeatmapData(heatmapData);

      return {
        success: true,
        data: summarizedData,
        dataForDownstreamPrompt: {
          summarizeCapabilityHeatmap: {
            dataSummary: `Summarized ${summarizedData.summary.total_roles} roles across ${summarizedData.summary.total_groups} groups with ${summarizedData.summary.total_capabilities} unique capabilities.`,
            structured: {
              totalRoles: summarizedData.summary.total_roles,
              totalGroups: summarizedData.summary.total_groups,
              totalCapabilities: summarizedData.summary.total_capabilities,
              matrixDimensions: summarizedData.summary.matrix_dimensions
            },
            truncated: false
          }
        }
      };

    } catch (error) {
      console.error('Error in summarizeCapabilityHeatmap:', error);
      
      return {
        success: false,
        error: {
          type: 'SUMMARY_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: error
        }
      };
    }
  },
  getDefaultArgs: (context) => ({
    heatmapData: context.heatmapData || []
  })
}; 