import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../../database.types.ts';
import { MCPActionV2, MCPResponse } from '../../types/action.ts';
import { logAgentProgress } from '../../../chatUtils.ts';
import { executeHeatmapQuery, formatCompanyIds } from '../utils.ts';
import { analyzeCapabilityData } from '../../utils/capabilityAnalysis.ts';

interface HeatmapResponse {
  region: string;
  capability: string;
  role_count: number;
  total_roles: number;
  company: string;
  percentage: number;
}

export { HeatmapResponse };

export async function generateCapabilityHeatmapByRegionBase(
  supabase: SupabaseClient<Database>,
  companyIds: string[]
): Promise<HeatmapResponse[]> {
  const companyIdsStr = formatCompanyIds(companyIds);
  const query = `
    SELECT
      r.location AS region,
      c.name AS capability,
      COUNT(*) AS role_count,
      (
        SELECT COUNT(DISTINCT r2.id)
        FROM roles r2
        WHERE r2.company_id = ANY(ARRAY[${companyIdsStr}])
        AND r2.location = r.location
      ) as total_roles,
      co.name AS company,
      CASE 
        WHEN (
          SELECT COUNT(DISTINCT r2.id)
          FROM roles r2
          WHERE r2.company_id = ANY(ARRAY[${companyIdsStr}])
          AND r2.location = r.location
        ) = 0 THEN 0
        ELSE ROUND((COUNT(*)::float / (
          SELECT COUNT(DISTINCT r2.id)::float
          FROM roles r2
          WHERE r2.company_id = ANY(ARRAY[${companyIdsStr}])
          AND r2.location = r.location
        ) * 100)::numeric, 1)
      END as percentage
    FROM roles r
    JOIN role_capabilities rc ON rc.role_id = r.id
    JOIN capabilities c ON rc.capability_id = c.id
    JOIN companies co ON r.company_id = co.id
    WHERE r.company_id = ANY(ARRAY[${companyIdsStr}])
    GROUP BY r.location, c.name, co.name
    ORDER BY r.location, role_count DESC`;

  const data = await executeHeatmapQuery(supabase, query, companyIds);
  
  return data.map(row => ({
    region: row.region,
    capability: row.capability,
    role_count: parseInt(row.role_count),
    total_roles: parseInt(row.total_roles),
    company: row.company,
    percentage: parseFloat(row.percentage)
  }));
}

export const generateCapabilityHeatmapByRegion: MCPActionV2 = {
  id: 'generateCapabilityHeatmapByRegion',
  title: 'Generate Capability Heatmap by Region',
  description: 'Summarizes capability presence by region and compares role distribution.',
  applicableRoles: ['analyst'],
  capabilityTags: ['Workforce Planning', 'Capability Analysis'],
  requiredInputs: ['companyIds'],
  tags: ['heatmap', 'region', 'capability', 'analysis'],
  suggestedPrerequisites: [],
  suggestedPostrequisites: [],
  usesAI: true,

  async actionFn(request): Promise<MCPResponse> {
    const { supabase, companyIds, sessionId, message } = request;

    if (!companyIds?.length) {
      return {
        success: false,
        error: {
          type: 'INVALID_INPUT',
          message: 'At least one company ID is required',
          details: null
        }
      };
    }

    try {
      // Log starting analysis
      if (sessionId) {
        await logAgentProgress(
          supabase,
          sessionId,
          "I'm analyzing capability distribution across regions...",
          { phase: 'region_analysis_start' }
        );
      }

      // Get base data
      const formattedData = await generateCapabilityHeatmapByRegionBase(supabase, companyIds);

      // Always perform analysis with either provided message or default
      const analysis = await analyzeCapabilityData(
        formattedData,
        message || 'provide insights on the capability distribution across regions'
      );

      // Log completion with analysis
      if (sessionId) {
        await logAgentProgress(
          supabase,
          sessionId,
          analysis.response || "Capability region analysis complete.",
          { phase: 'region_analysis_complete' }
        );
      }

      return {
        success: true,
        data: formattedData,
        dataForDownstreamPrompt: {
          generateCapabilityHeatmapByRegion: {
            truncated: false,
            structured: {
              totalRoles: formattedData[0]?.total_roles || 0,
              regionCount: new Set(formattedData.map(d => d.region)).size,
              capabilityCount: new Set(formattedData.map(d => d.capability)).size
            },
            dataSummary: "Analyzed capability distribution across regions."
          }
        },
        chatResponse: {
          message: analysis.response,
          followUpQuestion: analysis.followUpQuestion
        }
      };

    } catch (error) {
      console.error('Error in generateCapabilityHeatmapByRegion:', error);
      
      if (sessionId) {
        await logAgentProgress(
          supabase,
          sessionId,
          "I encountered an error while analyzing region data.",
          { phase: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
        );
      }

      return {
        success: false,
        error: {
          type: 'ANALYSIS_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: error
        }
      };
    }
  },

  getDefaultArgs: (context) => ({
    companyIds: context.companyIds || []
  })
}; 