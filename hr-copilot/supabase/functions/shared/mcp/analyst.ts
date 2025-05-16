import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { AnalystMCPResponse, PlannerRecommendation } from '../types/mcpTypes.ts';
import { logAgentAction } from '../agent/logAgentAction.ts';
import { buildSafePrompt } from './promptBuilder.ts';
import { ModelId } from './promptTypes.ts';

// Valid scopes for analysis
const VALID_SCOPES = ['taxonomy', 'division', 'region', 'all'] as const;
type AnalysisScope = typeof VALID_SCOPES[number];

// Valid output formats
const VALID_OUTPUT_FORMATS = ['summary', 'table', 'chart', 'action_plan', 'compare', 'raw'] as const;
type OutputFormat = typeof VALID_OUTPUT_FORMATS[number];

interface AnalystLoopInput {
  mode: 'analyst';
  insightId?: string;
  context?: {
    lastMessage?: string;
    companyIds?: string[];
    scope?: AnalysisScope;
    scopeValue?: string;
    outputFormat?: OutputFormat;
  };
  plannerRecommendations: PlannerRecommendation[];
}

// Validate input parameters
function validateAnalystInput(input: AnalystLoopInput): void {
  // Check company IDs
  if (!input.context?.companyIds?.length) {
    throw new Error('At least one company ID is required');
  }

  // Validate scope if provided
  if (input.context.scope && !VALID_SCOPES.includes(input.context.scope)) {
    throw new Error(`Invalid scope. Must be one of: ${VALID_SCOPES.join(', ')}`);
  }

  // Validate output format if provided
  if (input.context.outputFormat && !VALID_OUTPUT_FORMATS.includes(input.context.outputFormat)) {
    throw new Error(`Invalid output format. Must be one of: ${VALID_OUTPUT_FORMATS.join(', ')}`);
  }

  // Validate scope value if provided
  if (input.context.scopeValue && !input.context.scope) {
    throw new Error('Scope must be specified when providing a scope value');
  }
}

async function generateCapabilityHeatmapByScope(
  supabase: SupabaseClient<Database>,
  companyIds: string[],
  scope: AnalysisScope,
  scopeValue?: string
) {
  // Convert company IDs array to a string of quoted UUIDs with proper casting
  const companyIdsStr = companyIds.map(id => `'${id}'::uuid`).join(', ');
  let query = '';
  
  switch (scope) {
    case 'taxonomy':
      query = `
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
        ${scopeValue ? `AND t.name = '${scopeValue}'` : ''}
        GROUP BY t.name, c.name, co.name
        ORDER BY t.name, role_count DESC`;
      break;
      
    case 'division':
      query = `
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
        ${scopeValue ? `AND d.name = '${scopeValue}'` : ''}
        GROUP BY d.name, c.name, co.name
        ORDER BY d.name, role_count DESC`;
      break;
      
    case 'region':
      query = `
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
        ${scopeValue ? `AND r.location = '${scopeValue}'` : ''}
        GROUP BY r.location, c.name, co.name
        ORDER BY r.location, role_count DESC`;
      break;
      
    case 'all':
      query = `
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
      break;
  }

  // Log the query for debugging
  console.log('=== Debug Info for SQL Query ===');
  console.log('Scope:', scope);
  console.log('Query:', query.trim());
  console.log('Company IDs:', companyIds);
  console.log('Scope Value:', scopeValue);
  console.log('=============================');

  try {
    const { data, error } = await supabase.rpc('execute_sql', { 
      sql: query.trim(),
      params: {}  // Empty params since we're doing direct interpolation
    });
    
    if (error) {
      console.error('Database Error:', error);
      if (error.message.includes('Only SELECT queries are allowed')) {
        throw new Error('Security violation: Only SELECT queries are allowed');
      }
      throw error;
    }

    // Handle empty result sets
    if (!data || (Array.isArray(data) && data.length === 0)) {
      throw new Error(`No data found for the specified ${scope}${scopeValue ? ` (${scopeValue})` : ''}`);
    }

    return data;
  } catch (error) {
    // Log the full error for debugging
    console.error('Full error:', error);
    
    // Enhance error message based on error type
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      throw new Error('Required database tables are missing. Please ensure the schema is properly set up.');
    }
    throw error;
  }
}

export async function runAnalystLoop(
  supabase: SupabaseClient<Database>,
  input: AnalystLoopInput
): Promise<AnalystMCPResponse> {
  try {
    const actionsTaken: string[] = [];
    let data = null;
    let error = null;

    // Validate input parameters
    validateAnalystInput(input);

    // Execute insight based on insightId
    if (input.insightId && input.context) {
      switch (input.insightId) {
        case 'generateCapabilityHeatmapByScope':
          if (!input.context.scope) {
            throw new Error('Scope is required for capability heatmap');
          }
          
          try {
            data = await generateCapabilityHeatmapByScope(
              supabase,
              input.context.companyIds || [],
              input.context.scope,
              input.context.scopeValue
            );
            
            actionsTaken.push('Generated capability heatmap');
          } catch (e) {
            // Log specific error for debugging
            console.error('Error generating capability heatmap:', e);
            throw new Error(`Failed to generate capability heatmap: ${e instanceof Error ? e.message : 'Unknown error'}`);
          }
          break;
          
        // Additional insights will be implemented here
        default:
          throw new Error(`Unsupported insight: ${input.insightId}`);
      }
    }

    // Log the analyst action
    if (input.context?.companyIds?.[0]) {
      try {
        await logAgentAction(supabase, {
          entityType: 'company',
          entityId: input.context.companyIds[0],
          payload: {
            action: 'analyst_insight',
            insightId: input.insightId,
            parameters: input.context,
            success: true,
            error: null
          }
        });
      } catch (e) {
        // Non-blocking error - log but continue
        console.error('Failed to log analyst action:', e);
      }
    }

    // Generate chat response based on the data and format
    let promptResult;
    try {
      promptResult = await buildSafePrompt(
        'openai:gpt-4o' as ModelId,
        {
          systemPrompt: `You are an analyst helping interpret workforce capability data. 
The data shows capability distribution across ${input.context?.scope || 'the organization'}.
${input.context?.scopeValue ? `Focusing on: ${input.context.scopeValue}` : ''}
Format your response as ${input.context?.outputFormat || 'action_plan'}.`,
          data: data || {},
          context: {
            scope: input.context?.scope,
            scopeValue: input.context?.scopeValue,
            outputFormat: input.context?.outputFormat || 'action_plan'
          }
        }
      );
    } catch (e) {
      console.error('Error generating analysis prompt:', e);
      promptResult = 'I was unable to generate a detailed analysis, but I can show you the raw data.';
    }

    return {
      success: true,
      data: {
        matches: [],
        recommendations: [],
        insightData: data,
        chatResponse: {
          message: promptResult,
          followUpQuestion: 'Would you like to explore another insight or analyze this data differently?'
        },
        actionsTaken,
        nextActions: [
          {
            type: 'suggest_insight',
            description: 'Would you like to explore another insight or analyze this data differently?'
          }
        ]
      }
    };
  } catch (e) {
    // Log the error for debugging
    console.error('Error in analyst loop:', e);

    // Log the failed action
    if (input.context?.companyIds?.[0]) {
      try {
        await logAgentAction(supabase, {
          entityType: 'company',
          entityId: input.context.companyIds[0],
          payload: {
            action: 'analyst_insight',
            insightId: input.insightId,
            parameters: input.context,
            success: false,
            error: e instanceof Error ? e.message : 'Unknown error'
          }
        });
      } catch (logError) {
        console.error('Failed to log error state:', logError);
      }
    }

    // Return a user-friendly error response
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Unknown error',
      data: {
        matches: [],
        recommendations: [],
        insightData: null,
        chatResponse: {
          message: `I encountered an error while analyzing the data: ${e instanceof Error ? e.message : 'Unknown error'}`,
          followUpQuestion: 'Would you like to try a different analysis approach?'
        },
        actionsTaken: [],
        nextActions: [
          {
            type: 'suggest_insight',
            description: 'Try a different analysis scope or method'
          }
        ]
      }
    };
  }
} 