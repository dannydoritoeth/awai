import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../../database.types.ts';
import { MCPActionV2, MCPResponse } from '../../types/action.ts';
import { logAgentProgress } from '../../../chatUtils.ts';
import { executeHeatmapQuery, formatCompanyIds } from '../utils.ts';

interface HeatmapResponse {
  company: string;
  capability: string;
  role_count: number;
  total_roles: number;
}

async function generateCapabilityHeatmapByCompanyBase(
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
      ) as total_roles
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
    total_roles: parseInt(row.total_roles)
  }));
}

export const generateCapabilityHeatmapByCompany: MCPActionV2 = {
  id: 'generateCapabilityHeatmapByCompany',
  title: 'Generate Capability Heatmap by Company',
  description: 'Breaks down capability role counts and totals by company.',
  applicableRoles: ['analyst'],
  capabilityTags: ['Heatmap', 'Company'],
  requiredInputs: ['companyIds'],
  tags: ['heatmap', 'company', 'data'],
  usesAI: false,
  actionFn: async (request): Promise<MCPResponse<HeatmapResponse[]>> => {
    const { supabase, companyIds, sessionId } = request;

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

      const data = await generateCapabilityHeatmapByCompanyBase(supabase, companyIds);

      // Log completion
      if (sessionId) {
        await logAgentProgress(
          supabase,
          sessionId,
          "Capability company analysis complete.",
          { phase: 'company_analysis_complete' }
        );
      }

      return {
        success: true,
        data,
        dataForDownstreamPrompt: {
          generateCapabilityHeatmapByCompany: {
            dataSummary: `Analyzed capability distribution across ${new Set(data.map(d => d.company)).size} companies.`,
            structured: {
              companyCount: new Set(data.map(d => d.company)).size,
              capabilityCount: new Set(data.map(d => d.capability)).size,
              totalRoles: Math.max(...data.map(d => d.total_roles))
            },
            truncated: false
          }
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