import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../../database.types.ts';
import { MCPActionV2, MCPResponse } from '../../types/action.ts';
import { logAgentProgress } from '../../../chatUtils.ts';
import { executeHeatmapQuery, formatCompanyIds } from '../utils.ts';
import { analyzeCapabilityData } from '../../utils/capabilityAnalysis.ts';

interface HeatmapResponse {
  division: string;
  capability: string;
  role_count: number;
  total_roles: number;
  company: string;
  percentage: number;
}

export { HeatmapResponse };

export async function generateCapabilityHeatmapByDivisionBase(
  supabase: SupabaseClient<Database>,
  companyIds: string[]
): Promise<HeatmapResponse[]> {
  const companyIdsStr = formatCompanyIds(companyIds);
  const query = `
    SELECT
      d.name AS division,
      c.name AS capability,
      COUNT(*) AS role_count,
      (
        SELECT COUNT(DISTINCT r2.id)
        FROM roles r2
        JOIN divisions d2 ON r2.division_id = d2.id
        WHERE r2.company_id = ANY(ARRAY[${companyIdsStr}])
        AND d2.name = d.name
      ) as total_roles,
      co.name AS company,
      CASE 
        WHEN (
          SELECT COUNT(DISTINCT r2.id)
          FROM roles r2
          JOIN divisions d2 ON r2.division_id = d2.id
          WHERE r2.company_id = ANY(ARRAY[${companyIdsStr}])
          AND d2.name = d.name
        ) = 0 THEN 0
        ELSE ROUND((COUNT(*)::float / (
          SELECT COUNT(DISTINCT r2.id)::float
          FROM roles r2
          JOIN divisions d2 ON r2.division_id = d2.id
          WHERE r2.company_id = ANY(ARRAY[${companyIdsStr}])
          AND d2.name = d.name
        ) * 100)::numeric, 1)
      END as percentage
    FROM roles r
    JOIN divisions d ON r.division_id = d.id
    JOIN role_capabilities rc ON rc.role_id = r.id
    JOIN capabilities c ON rc.capability_id = c.id
    JOIN companies co ON r.company_id = co.id
    WHERE r.company_id = ANY(ARRAY[${companyIdsStr}])
    GROUP BY d.name, c.name, co.name
    ORDER BY d.name, role_count DESC`;

  const data = await executeHeatmapQuery(supabase, query, companyIds);
  
  return data.map(row => ({
    division: row.division,
    capability: row.capability,
    role_count: parseInt(row.role_count),
    total_roles: parseInt(row.total_roles),
    company: row.company,
    percentage: parseFloat(row.percentage)
  }));
}

export const generateCapabilityHeatmapByDivision: MCPActionV2 = {
  id: 'generateCapabilityHeatmapByDivision',
  title: 'Generate Capability Heatmap by Division',
  description: 'Displays capability counts and coverage by division for selected companies.',
  applicableRoles: ['analyst'],
  capabilityTags: ['Workforce Planning', 'Capability Analysis'],
  requiredInputs: ['companyIds'],
  tags: ['heatmap', 'division', 'capability', 'analysis'],
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
          "I'm analyzing capability distribution across divisions...",
          { phase: 'division_analysis_start' }
        );
      }

      // Get base data
      const formattedData = await generateCapabilityHeatmapByDivisionBase(supabase, companyIds);

      // Always perform analysis with either provided message or default
      const analysis = await analyzeCapabilityData(
        formattedData,
        message || 'provide insights on the capability distribution across divisions'
      );

      // Log completion with analysis
      if (sessionId) {
        await logAgentProgress(
          supabase,
          sessionId,
          analysis.response || "Capability division analysis complete.",
          { phase: 'division_analysis_complete' }
        );
      }

      return {
        success: true,
        data: formattedData,
        dataForDownstreamPrompt: {
          generateCapabilityHeatmapByDivision: {
            truncated: false,
            structured: {
              totalRoles: formattedData[0]?.total_roles || 0,
              divisionCount: new Set(formattedData.map(d => d.division)).size,
              capabilityCount: new Set(formattedData.map(d => d.capability)).size
            },
            dataSummary: "Analyzed capability distribution across divisions."
          }
        },
        chatResponse: {
          message: analysis.response,
          followUpQuestion: analysis.followUpQuestion
        }
      };

    } catch (error) {
      console.error('Error in generateCapabilityHeatmapByDivision:', error);
      
      if (sessionId) {
        await logAgentProgress(
          supabase,
          sessionId,
          "I encountered an error while analyzing division data.",
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