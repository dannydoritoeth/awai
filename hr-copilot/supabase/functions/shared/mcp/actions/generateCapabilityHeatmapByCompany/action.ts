import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../../database.types.ts';
import { MCPActionV2, MCPResponse } from '../../types/action.ts';
import { logAgentProgress } from '../../../chatUtils.ts';
import { executeHeatmapQuery, formatCompanyIds } from '../utils.ts';
import { analyzeCapabilityData } from '../../utils/capabilityAnalysis.ts';

interface HeatmapResponse {
  company: string;
  capability: string;
  role_count: number;
  total_roles: number;
  percentage: number;
}

export { HeatmapResponse };

export async function generateCapabilityHeatmapByCompanyBase(
  supabase: SupabaseClient<Database>,
  companyIds: string[]
): Promise<HeatmapResponse[]> {
  const companyIdsStr = formatCompanyIds(companyIds);
  const query = `
    SELECT
      co.name AS company,
      c.name AS capability,
      COUNT(*) AS role_count,
      (
        SELECT COUNT(DISTINCT r2.id)
        FROM roles r2
        JOIN companies co2 ON r2.company_id = co2.id
        WHERE r2.company_id = ANY(ARRAY[${companyIdsStr}])
        AND co2.name = co.name
      ) as total_roles,
      CASE 
        WHEN (
          SELECT COUNT(DISTINCT r2.id)
          FROM roles r2
          JOIN companies co2 ON r2.company_id = co2.id
          WHERE r2.company_id = ANY(ARRAY[${companyIdsStr}])
          AND co2.name = co.name
        ) = 0 THEN 0
        ELSE ROUND((COUNT(*)::float / (
          SELECT COUNT(DISTINCT r2.id)::float
          FROM roles r2
          JOIN companies co2 ON r2.company_id = co2.id
          WHERE r2.company_id = ANY(ARRAY[${companyIdsStr}])
          AND co2.name = co.name
        ) * 100)::numeric, 1)
      END as percentage
    FROM role_capabilities rc
    JOIN capabilities c ON rc.capability_id = c.id
    JOIN roles r ON rc.role_id = r.id
    JOIN companies co ON r.company_id = co.id
    WHERE r.company_id = ANY(ARRAY[${companyIdsStr}])
    GROUP BY co.name, c.name
    ORDER BY co.name, role_count DESC`;

  const data = await executeHeatmapQuery(supabase, query, companyIds);
  
  return data.map(row => ({
    company: row.company,
    capability: row.capability,
    role_count: parseInt(row.role_count),
    total_roles: parseInt(row.total_roles),
    percentage: parseFloat(row.percentage)
  }));
}

export const generateCapabilityHeatmapByCompany: MCPActionV2 = {
  id: 'generateCapabilityHeatmapByCompany',
  title: 'Generate Capability Heatmap by Company',
  description: 'Breaks down capability role counts and totals by company.',
  applicableRoles: ['analyst'],
  capabilityTags: ['Workforce Planning', 'Capability Analysis'],
  requiredInputs: ['companyIds'],
  tags: ['heatmap', 'company', 'capability', 'analysis'],
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
          "I'm analyzing capability distribution across companies...",
          { phase: 'company_analysis_start' }
        );
      }

      // Get base data
      const formattedData = await generateCapabilityHeatmapByCompanyBase(supabase, companyIds);

      // Always perform analysis with either provided message or default
      const analysis = await analyzeCapabilityData(
        formattedData,
        message || 'provide insights on the capability distribution across companies'
      );

      // Log completion with analysis
      if (sessionId) {
        await logAgentProgress(
          supabase,
          sessionId,
          analysis.response || "Capability company analysis complete.",
          { phase: 'company_analysis_complete' }
        );
      }

      return {
        success: true,
        data: formattedData,
        dataForDownstreamPrompt: {
          generateCapabilityHeatmapByCompany: {
            truncated: false,
            structured: {
              totalRoles: formattedData[0]?.total_roles || 0,
              companyCount: new Set(formattedData.map(d => d.company)).size,
              capabilityCount: new Set(formattedData.map(d => d.capability)).size
            },
            dataSummary: "Analyzed capability distribution across companies."
          }
        },
        chatResponse: {
          message: analysis.response,
          followUpQuestion: analysis.followUpQuestion
        }
      };

    } catch (error) {
      console.error('Error in generateCapabilityHeatmapByCompany:', error);
      
      if (sessionId) {
        await logAgentProgress(
          supabase,
          sessionId,
          "I encountered an error while analyzing company data.",
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