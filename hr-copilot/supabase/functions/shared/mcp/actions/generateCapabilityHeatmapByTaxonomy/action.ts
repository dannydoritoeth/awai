import { z } from 'https://deno.land/x/zod@v3.21.4/mod.ts';
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import type { Database } from '../../../../database.types.ts';
import { MCPActionV2, MCPResponse } from '../../types/action.ts';
import { analyzeCapabilityData, CapabilityData } from '../../utils/capabilityAnalysis.ts';
import { logAgentProgress } from '../../../chatUtils.ts';
import { executeHeatmapQuery, formatCompanyIds } from '../utils.ts';

interface HeatmapResponse {
  taxonomy: string;
  capability: string;
  role_count: number;
  total_roles: number;
  company: string;
  percentage: number;
}

export { HeatmapResponse };

export async function generateCapabilityHeatmapByTaxonomyBase(
  supabase: SupabaseClient<Database>,
  companyIds: string[]
): Promise<HeatmapResponse[]> {
  const companyIdsStr = formatCompanyIds(companyIds);
  const query = `
    SELECT 
      t.name AS taxonomy,
      c.name AS capability,
      COUNT(DISTINCT rc.role_id) AS role_count,
      (
        SELECT COUNT(DISTINCT r2.id)
        FROM roles r2
        JOIN role_taxonomies rt2 ON rt2.role_id = r2.id
        WHERE rt2.taxonomy_id = t.id
        AND r2.company_id = ANY(ARRAY[${companyIdsStr}])
      ) as total_roles,
      co.name AS company,
      ROUND((COUNT(DISTINCT rc.role_id)::float / (
        SELECT COUNT(DISTINCT r2.id)
        FROM roles r2
        JOIN role_taxonomies rt2 ON rt2.role_id = r2.id
        WHERE rt2.taxonomy_id = t.id
        AND r2.company_id = ANY(ARRAY[${companyIdsStr}])
      )::float * 100)::numeric, 1) as percentage
    FROM taxonomy t
    JOIN role_taxonomies rt ON rt.taxonomy_id = t.id
    JOIN roles r ON rt.role_id = r.id
    JOIN role_capabilities rc ON rc.role_id = r.id
    JOIN capabilities c ON rc.capability_id = c.id
    JOIN companies co ON r.company_id = co.id
    WHERE r.company_id = ANY(ARRAY[${companyIdsStr}])
    GROUP BY t.id, t.name, c.name, co.name
    ORDER BY t.name, COUNT(DISTINCT rc.role_id) DESC`;

  const data = await executeHeatmapQuery(supabase, query, companyIds);
  
  return data.map(row => ({
    taxonomy: row.taxonomy,
    capability: row.capability,
    role_count: parseInt(row.role_count),
    total_roles: parseInt(row.total_roles),
    company: row.company,
    percentage: parseFloat(row.percentage)
  }));
}

export const generateCapabilityHeatmapByTaxonomy: MCPActionV2 = {
  id: 'generateCapabilityHeatmapByTaxonomy',
  title: 'Generate Capability Heatmap by Taxonomy',
  description: 'Shows how capabilities are distributed across taxonomy groups for selected companies.',
  applicableRoles: ['analyst'],
  capabilityTags: ['Workforce Planning', 'Capability Analysis'],
  requiredInputs: ['companyIds'],
  tags: ['heatmap', 'taxonomy', 'capability', 'analysis'],
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
          "I'm analyzing capability distribution across taxonomies...",
          { phase: 'taxonomy_analysis_start' }
        );
      }

      // Get base data
      const formattedData = await generateCapabilityHeatmapByTaxonomyBase(supabase, companyIds);

      console.log('KKK Formatted data:', formattedData);

      // Always perform analysis with either provided message or default
      const analysis = await analyzeCapabilityData(
        formattedData,
        message || 'provide insights on the capability distribution across taxonomies'
      );

      console.log('KKK Analysis:', analysis);

      // Log completion with analysis
      if (sessionId) {
        await logAgentProgress(
          supabase,
          sessionId,
          analysis.response || "Capability taxonomy analysis complete.",
          { phase: 'taxonomy_analysis_complete' }
        );
      }

      return {
        success: true,
        data: formattedData,
        dataForDownstreamPrompt: {
          generateCapabilityHeatmapByTaxonomy: {
            truncated: false,
            structured: {
              totalRoles: formattedData[0]?.total_roles || 0,
              taxonomyCount: new Set(formattedData.map(d => d.taxonomy)).size,
              capabilityCount: new Set(formattedData.map(d => d.capability)).size
            },
            dataSummary: "Analyzed capability distribution across taxonomies."
          }
        },
        chatResponse: {
          message: analysis.response,
          followUpQuestion: analysis.followUpQuestion
        }
      };

    } catch (error) {
      console.error('Error in generateCapabilityHeatmapByTaxonomy:', error);
      
      if (sessionId) {
        await logAgentProgress(
          supabase,
          sessionId,
          "I encountered an error while analyzing taxonomy data.",
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