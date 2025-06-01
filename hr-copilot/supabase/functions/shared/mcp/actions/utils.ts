import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../database.types.ts';

/**
 * Executes a SQL query for capability heatmap generation
 */
export async function executeHeatmapQuery(
  supabase: SupabaseClient<Database>,
  query: string,
  companyIds: string[]
): Promise<any[]> {
  const { data, error } = await supabase.rpc('execute_sql', { 
    sql: query.trim(),
    params: {}
  });

  if (error) throw error;
  return data;
}

/**
 * Formats company IDs for SQL query
 */
export function formatCompanyIds(companyIds: string[]): string {
  return companyIds.map(id => `'${id}'::uuid`).join(', ');
}

/**
 * Summarizes heatmap data for AI processing
 */
export function summarizeHeatmapData(data: any[]) {
  if (!Array.isArray(data)) return data;
  
  // First pass: collect all unique capabilities and groups
  const capabilities = new Set<string>();
  const groups = new Set<string>();
  const groupTotals: Record<string, number> = {};
  
  data.forEach(item => {
    const groupKey = item.taxonomy || item.division || item.region || item.company || 'organization';
    groups.add(groupKey);
    capabilities.add(item.capability);
    groupTotals[groupKey] = item.total_roles || 0;
  });

  // Create the matrix data structure
  const matrix: Record<string, Record<string, number>> = {};
  groups.forEach(group => {
    matrix[group] = {};
    capabilities.forEach(cap => {
      matrix[group][cap] = 0;
    });
  });

  // Fill in the matrix with actual values
  data.forEach(item => {
    const groupKey = item.taxonomy || item.division || item.region || item.company || 'organization';
    matrix[groupKey][item.capability] = item.role_count;
  });

  // Convert to CSV format
  const allRows: string[] = [];
  const capabilitiesArray = Array.from(capabilities);
  
  // Build the heatmap CSV
  allRows.push('# Capability Heatmap');
  allRows.push('Group,Total Roles,' + capabilitiesArray.map(cap => `"${cap}"`).join(','));
  
  Object.entries(matrix)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([group, capCounts]) => {
      const rowValues = capabilitiesArray.map(cap => capCounts[cap]);
      const safeGroup = group.includes(',') ? `"${group}"` : group;
      allRows.push(`${safeGroup},${groupTotals[group]},${rowValues.join(',')}`);
    });

  // Calculate summary statistics
  let totalRoles = 0;
  const capabilityStats = new Map<string, { total: number, groups: number }>();
  
  Object.entries(matrix).forEach(([group, capCounts]) => {
    totalRoles += groupTotals[group];
    Object.entries(capCounts).forEach(([cap, count]) => {
      if (!capabilityStats.has(cap)) {
        capabilityStats.set(cap, { total: 0, groups: 0 });
      }
      const stats = capabilityStats.get(cap)!;
      if (count > 0) {
        stats.total += count;
        stats.groups += 1;
      }
    });
  });

  // Add summary section
  allRows.push('');
  allRows.push('# Summary Statistics');
  allRows.push(`Total Roles Analyzed: ${totalRoles}`);
  allRows.push(`Total Groups: ${groups.size}`);
  allRows.push(`Total Unique Capabilities: ${capabilities.size}`);
  allRows.push('');
  
  // Add top capabilities section
  allRows.push('# Top Capabilities');
  allRows.push('capability,total_occurrences,groups_present,average_per_group');
  
  Array.from(capabilityStats.entries())
    .sort(([,a], [,b]) => b.total - a.total)
    .slice(0, 10)  // Top 10 capabilities
    .forEach(([cap, stats]) => {
      const avgPerGroup = (stats.total / stats.groups).toFixed(1);
      allRows.push(`"${cap}",${stats.total},${stats.groups},${avgPerGroup}`);
    });

  return {
    csv_data: allRows.join('\n'),
    summary: {
      total_roles: totalRoles,
      total_capabilities: capabilities.size,
      total_groups: groups.size,
      matrix_dimensions: {
        rows: groups.size,
        columns: capabilities.size
      },
      groups: Array.from(groups).map(name => ({
        name,
        total_roles: groupTotals[name],
        unique_capabilities: Object.values(matrix[name]).filter(v => v > 0).length,
        top_capabilities: Object.entries(matrix[name])
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([cap, count]) => ({
            name: cap,
            count,
            percentage: ((count / groupTotals[name]) * 100).toFixed(1)
          }))
      }))
    }
  };
}