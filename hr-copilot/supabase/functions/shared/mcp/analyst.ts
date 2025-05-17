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
      co.name AS company,
      COUNT(*) AS role_count
    FROM role_capabilities rc
    JOIN capabilities c ON rc.capability_id = c.id
    JOIN role_taxonomies rt ON rc.role_id = rt.role_id
    JOIN taxonomy t ON rt.taxonomy_id = t.id
    JOIN roles r ON rc.role_id = r.id
    JOIN companies co ON r.company_id = co.id
    WHERE r.company_id = ANY(ARRAY[${companyIdsStr}])
    GROUP BY t.name, c.name, co.name
    ORDER BY t.name, role_count DESC`;

  const { data, error } = await supabase.rpc('execute_sql', { 
    sql: query.trim(),
    params: {}
  });

  if (error) throw error;
  return data;
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
      co.name AS company,
      COUNT(*) AS role_count
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
  return data;
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
      co.name AS company,
      COUNT(*) AS role_count
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
  return data;
}

async function generateCapabilityHeatmapByCompany(
  supabase: SupabaseClient<Database>,
  companyIds: string[]
) {
  const companyIdsStr = companyIds.map(id => `'${id}'::uuid`).join(', ');
  const query = `
    SELECT
      c.name AS capability,
      co.name AS company,
      COUNT(*) AS role_count
    FROM role_capabilities rc
    JOIN capabilities c ON rc.capability_id = c.id
    JOIN roles r ON rc.role_id = r.id
    JOIN companies co ON r.company_id = co.id
    WHERE r.company_id = ANY(ARRAY[${companyIdsStr}])
    GROUP BY c.name, co.name
    ORDER BY role_count DESC`;

  const { data, error } = await supabase.rpc('execute_sql', { 
    sql: query.trim(),
    params: {}
  });

  if (error) throw error;
  return data;
}

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
      // Summarize data before sending to OpenAI
      const summarizeData = (data: any[]) => {
        if (!Array.isArray(data)) return data;
        
        // Group by taxonomy/division/region and capability
        const summary: Record<string, Record<string, number>> = data.reduce((acc, item) => {
          const groupKey = item.taxonomy || item.division || item.region || 'company';
          const capabilityKey = item.capability;
          
          if (!acc[groupKey]) {
            acc[groupKey] = {};
          }
          if (!acc[groupKey][capabilityKey]) {
            acc[groupKey][capabilityKey] = 0;
          }
          acc[groupKey][capabilityKey] += parseInt(item.role_count);
          return acc;
        }, {} as Record<string, Record<string, number>>);

        // Convert to array format
        return Object.entries(summary).map(([group, capabilities]) => ({
          group,
          capabilities: Object.entries(capabilities)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5) // Only take top 5 capabilities per group
            .map(([name, count]) => ({ name, count }))
        }));
      };

      promptResult = await buildSafePrompt(
        'openai:gpt-3.5-turbo' as ModelId,
        {
          systemPrompt: `Analyze workforce capability data and provide insights.
Format in markdown using:
- ## for sections
- Lists for points
- **Bold** for key metrics
- Tables for comparisons
- > for key insights
- \`\` for metrics`,
          data: summarizeData(data || []),
          context: {
            insightType: input.insightId,
            analysisType: input.insightId?.replace('generateCapabilityHeatmapBy', '')?.toLowerCase() || 'organization'
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