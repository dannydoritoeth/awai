import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import type { Database } from '../../../database.types.ts';
import { analyzeCapabilityData, CapabilityData } from '../utils/capabilityAnalysis.ts';
import { z } from 'https://deno.land/x/zod@v3.21.4/mod.ts';

export const generateCapabilityHeatmapByTaxonomy = {
  name: 'generateCapabilityHeatmapByTaxonomy',
  description: 'Generate and analyze capability distribution across taxonomies',
  argsSchema: z.object({
    companyIds: z.array(z.string()).min(1, 'At least one company ID is required'),
    message: z.string().optional()
  }),
  requiredContext: ['mode'],

  async run({ context, args }: { 
    context: { supabase: SupabaseClient<Database>; sessionId?: string },
    args: { companyIds: string[]; message?: string }
  }) {
    const companyIdsStr = args.companyIds.map(id => `'${id}'::uuid`).join(', ');
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

    // Execute query
    const { data, error } = await context.supabase.rpc('execute_sql', { 
      sql: query.trim(),
      params: {}
    });

    if (error) throw error;

    // Transform data to consistent structure
    const formattedData: CapabilityData[] = data.map((row: any) => ({
      taxonomy: row.taxonomy,
      capability: row.capability,
      role_count: parseInt(row.role_count),
      total_roles: parseInt(row.total_roles),
      company: row.company,
      percentage: parseFloat(row.percentage)
    }));

    // Analyze the data
    const analysis = await analyzeCapabilityData(
      formattedData,
      args.message || 'provide insights on the capability distribution across taxonomies'
    );

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
      chatResponse: analysis.response,
      followUpQuestion: analysis.followUpQuestion
    };
  }
}; 