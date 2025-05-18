import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { AnalystMCPResponse, PlannerRecommendation } from '../types/mcpTypes.ts';
import { logAgentAction } from '../agent/logAgentAction.ts';
import { buildSafePrompt } from './promptBuilder.ts';
import { ModelId } from './promptTypes.ts';
import { logAgentResponse } from '../chatUtils.ts';

// Deno type declaration
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

interface AnalystLoopInput {
  mode: 'analyst';
  insightId?: string;
  sessionId?: string;
  context?: {
    lastMessage?: string;
    companyIds?: string[];
    sessionId?: string;
  };
  plannerRecommendations: PlannerRecommendation[];
}

// Validate input parameters
function validateAnalystInput(input: AnalystLoopInput): void {
  if (input.insightId && (!input.context?.companyIds?.length)) {
    throw new Error('At least one company ID is required for analysis');
  }
}

async function generateCapabilityHeatmapByTaxonomy(
  supabase: SupabaseClient<Database>,
  companyIds: string[]
) {
  const companyIdsStr = companyIds.map(id => `'${id}'::uuid`).join(', ');
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

  const { data, error } = await supabase.rpc('execute_sql', { 
    sql: query.trim(),
    params: {}
  });

  if (error) throw error;
  
  // Return data in the same structure for consistent processing
  return data.map((row: any) => ({
    taxonomy: row.taxonomy,
    capability: row.capability,
    role_count: parseInt(row.role_count),
    total_roles: parseInt(row.total_roles),
    company: row.company,
    percentage: parseFloat(row.percentage)
  }));
}

async function generateCapabilityHeatmapByDivision(
  supabase: SupabaseClient<Database>,
  companyIds: string[]
) {
  const companyIdsStr = companyIds.map(id => `'${id}'::uuid`).join(', ');
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
      co.name AS company
    FROM roles r
    JOIN divisions d ON r.division_id = d.id
    JOIN role_capabilities rc ON rc.role_id = r.id
    JOIN capabilities c ON rc.capability_id = c.id
    JOIN companies co ON r.company_id = co.id
    WHERE r.company_id = ANY(ARRAY[${companyIdsStr}])
    GROUP BY d.name, c.name, co.name
    ORDER BY d.name, role_count DESC`;

  const { data, error } = await supabase.rpc('execute_sql', { 
    sql: query.trim(),
    params: {}
  });

  if (error) throw error;
  
  return data.map((row: any) => ({
    division: row.division,
    capability: row.capability,
    role_count: parseInt(row.role_count),
    total_roles: parseInt(row.total_roles),
    company: row.company
  }));
}

async function generateCapabilityHeatmapByRegion(
  supabase: SupabaseClient<Database>,
  companyIds: string[]
) {
  const companyIdsStr = companyIds.map(id => `'${id}'::uuid`).join(', ');
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
      co.name AS company
    FROM roles r
    JOIN role_capabilities rc ON rc.role_id = r.id
    JOIN capabilities c ON rc.capability_id = c.id
    JOIN companies co ON r.company_id = co.id
    WHERE r.company_id = ANY(ARRAY[${companyIdsStr}])
    GROUP BY r.location, c.name, co.name
    ORDER BY r.location, role_count DESC`;

  const { data, error } = await supabase.rpc('execute_sql', { 
    sql: query.trim(),
    params: {}
  });

  if (error) throw error;
  
  return data.map((row: any) => ({
    region: row.region,
    capability: row.capability,
    role_count: parseInt(row.role_count),
    total_roles: parseInt(row.total_roles),
    company: row.company
  }));
}

async function generateCapabilityHeatmapByCompany(
  supabase: SupabaseClient<Database>,
  companyIds: string[]
) {
  const companyIdsStr = companyIds.map(id => `'${id}'::uuid`).join(', ');
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

  const { data, error } = await supabase.rpc('execute_sql', { 
    sql: query.trim(),
    params: {}
  });

  if (error) throw error;
  
  return data.map((row: any) => ({
    company: row.company,
    capability: row.capability,
    role_count: parseInt(row.role_count),
    total_roles: parseInt(row.total_roles)
  }));
}

// Summarize data before sending to OpenAI
const summarizeData = (data: any[]) => {
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
};

export async function runAnalystLoop(
  supabase: SupabaseClient<Database>,
  input: AnalystLoopInput
): Promise<AnalystMCPResponse> {
  try {
    const actionsTaken: string[] = [];
    let data = null;
    let error: string | undefined = undefined;
    const sessionId = input.sessionId || input.context?.sessionId;

    // Validate input parameters
    validateAnalystInput(input);

    // Log starting analysis
    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        "I'm analyzing the capability data and preparing insights...",
        'mcp_analysis_start'
      );
    }

    // Execute insight based on insightId
    if (input.insightId && input.context?.companyIds) {
      switch (input.insightId) {
        case 'generateCapabilityHeatmapByTaxonomy':
          data = await generateCapabilityHeatmapByTaxonomy(
            supabase,
            input.context.companyIds
          );
          actionsTaken.push('Generated capability heatmap by taxonomy');
          break;

        case 'generateCapabilityHeatmapByDivision':
          data = await generateCapabilityHeatmapByDivision(
            supabase,
            input.context.companyIds
          );
          actionsTaken.push('Generated capability heatmap by division');
          break;

        case 'generateCapabilityHeatmapByRegion':
          data = await generateCapabilityHeatmapByRegion(
            supabase,
            input.context.companyIds
          );
          actionsTaken.push('Generated capability heatmap by region');
          break;

        case 'generateCapabilityHeatmapByCompany':
          data = await generateCapabilityHeatmapByCompany(
            supabase,
            input.context.companyIds
          );
          actionsTaken.push('Generated capability heatmap by company');
          break;

        default:
          throw new Error(`Unsupported insight: ${input.insightId}`);
      }

      // Log data gathering
      if (sessionId) {
        await logAgentResponse(
          supabase,
          sessionId,
          "I'm gathering capability data across the organization...",
          'mcp_data_loaded'
        );
      }
    }

    // Generate AI analysis of the data
    let chatResponse: string | undefined;
    let promptResult;
    let insightData = data;

    try {
      promptResult = await buildSafePrompt(
        'openai:gpt-3.5-turbo' as ModelId,
        {
          systemPrompt: `Analyze workforce capability data and provide insights focused on answering the user's specific question.
The data is organized in sections:
1. Capability Heatmap - Matrix showing capability distribution across groups
   - Rows: Groups (taxonomy/division/region/company)
   - Columns: Individual capabilities
   - Values: Number of roles with that capability
2. Summary Statistics - Overall metrics
3. Top Capabilities - Most common capabilities with their distribution

When analyzing, format your response using this structure:

# Capability Distribution Analysis

## Overview
- Present 2-3 key high-level findings
- Use bullet points for clarity
- Include the most important metrics

---

## Key Statistics
| Metric | Value |
|--------|--------|
| Total Roles | [number] |
| Number of Groups | [number] |
| Unique Capabilities | [number] |

---

## Group Analysis
### [Group Name]
- Total Roles: [number]
- Unique Capabilities: [number]
- Top Capabilities:
  1. [Capability] ([percentage]%)
  2. [Capability] ([percentage]%)
  3. [Capability] ([percentage]%)

[Repeat for other significant groups]

---

## Insights & Recommendations
### Strengths
- List 2-3 key strengths
- Use bullet points

### Areas for Improvement
- List 2-3 areas needing attention
- Use bullet points

### Recommendations
> **Priority Actions:**
> 1. First recommendation
> 2. Second recommendation
> 3. Third recommendation

Remember to:
- Focus primarily on answering the user's specific question
- Use data to support all insights
- Keep sections concise and scannable
- Use consistent formatting throughout`,
          data: summarizeData(data || []),
          context: {
            type: input.insightId?.replace('generateCapabilityHeatmapBy', '')?.toLowerCase() || 'organization',
            format: 'csv',
            userQuestion: input.context?.lastMessage || 'Analyze the capability distribution'
          }
        }
      );

      // Call OpenAI API
      const apiKey = Deno.env.get('OPENAI_API_KEY');
      if (!apiKey) {
        throw new Error('OpenAI API key not found');
      }

      // Log AI processing
      if (sessionId) {
        await logAgentResponse(
          supabase,
          sessionId,
          "Analyzing the data patterns and generating detailed insights...",
          'mcp_ai_processing'
        );
      }

      const requestBody = {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: promptResult.system
          },
          {
            role: 'user',
            content: promptResult.user
          }
        ],
        temperature: 0.7,
        max_tokens: 1500  // Reduced from 2500 to stay within limits
      };

      // Log request details for debugging
      console.log('OpenAI Request:', {
        url: 'https://api.openai.com/v1/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer [REDACTED]'
        },
        body: {
          ...requestBody,
          messages: requestBody.messages.map(m => ({
            ...m,
            content: m.content.length > 100 ? 
              `${m.content.substring(0, 100)}... (${m.content.length} chars)` : 
              m.content
          }))
        }
      });

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenAI API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(`OpenAI API Error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const responseData = await response.json();
      chatResponse = responseData.choices?.[0]?.message?.content;

      if (!chatResponse) {
        console.error('Invalid OpenAI response format:', responseData);
        throw new Error('Invalid response format from OpenAI API - no content in response');
      }

      // Log final response
      if (sessionId) {
        await logAgentResponse(
          supabase,
          sessionId,
          chatResponse,
          'mcp_final_response',
          undefined,
          {
            followUpQuestion: 'Would you like to explore another insight or analyze this data differently?',
            insightData: data || null,
            promptDetails: promptResult
          }
        );
      }

    } catch (e) {
      console.error('Error generating analysis:', e);
      chatResponse = 'I was unable to generate a detailed analysis, but I can show you the raw data.';
      error = e instanceof Error ? e.message : 'Unknown error';

      if (sessionId) {
        await logAgentResponse(
          supabase,
          sessionId,
          chatResponse,
          'mcp_error'
        );
      }
    }

    return {
      success: true,
      data: {
        matches: [],
        recommendations: [],
        insightData,
        chatResponse: {
          message: chatResponse || '',
          followUpQuestion: 'Would you like to explore another insight or analyze this data differently?',
          promptDetails: promptResult
        },
        actionsTaken,
        nextActions: [
          {
            type: 'suggest_insight',
            description: 'Would you like to explore another insight or analyze this data differently?'
          }
        ]
      },
      error
    };

  } catch (error) {
    console.error('Error in analyst loop:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const sessionId = input.sessionId || (input.context && input.context.sessionId);

    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        "I encountered an error while analyzing the data. Let me know if you'd like to try again.",
        'mcp_error'
      );
    }

    return {
      success: false,
      data: {
        matches: [],
        recommendations: [],
        insightData: null,
        chatResponse: {
          message: `I encountered an error while analyzing the data: ${errorMessage}`,
          followUpQuestion: 'Would you like to try a different analysis approach?'
        },
        actionsTaken: [],
        nextActions: [
          {
            type: 'suggest_insight',
            description: 'Try a different analysis scope or method'
          }
        ]
      },
      error: errorMessage
    };
  }
}

// Export the capability heatmap functions
export {
  generateCapabilityHeatmapByTaxonomy,
  generateCapabilityHeatmapByDivision,
  generateCapabilityHeatmapByRegion,
  generateCapabilityHeatmapByCompany,
  summarizeData
}; 