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

// Valid scopes for analysis
const VALID_SCOPES = ['taxonomy', 'division', 'region', 'all'] as const;
type AnalysisScope = typeof VALID_SCOPES[number];

// Valid output formats
const VALID_OUTPUT_FORMATS = ['summary', 'table', 'chart', 'action_plan', 'compare', 'raw'] as const;
type OutputFormat = typeof VALID_OUTPUT_FORMATS[number];

interface AnalystLoopInput {
  mode: 'analyst';
  insightId?: string;
  sessionId?: string;
  context?: {
    lastMessage?: string;
    companyIds?: string[];
    scope?: AnalysisScope;
    scopeValue?: string;
    outputFormat?: OutputFormat;
    sessionId?: string;
  };
  plannerRecommendations: PlannerRecommendation[];
}

// Validate input parameters
function validateAnalystInput(input: AnalystLoopInput): void {
  // Check company IDs only if we're doing an actual analysis
  if (input.insightId && (!input.context?.companyIds?.length)) {
    throw new Error('At least one company ID is required for analysis');
  }

  // Validate scope if provided
  if (input.context?.scope && !VALID_SCOPES.includes(input.context.scope)) {
    throw new Error(`Invalid scope. Must be one of: ${VALID_SCOPES.join(', ')}`);
  }

  // Validate output format if provided
  if (input.context?.outputFormat && !VALID_OUTPUT_FORMATS.includes(input.context.outputFormat)) {
    throw new Error(`Invalid output format. Must be one of: ${VALID_OUTPUT_FORMATS.join(', ')}`);
  }

  // Validate scope value if provided
  if (input.context?.scopeValue && !input.context?.scope) {
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

  // // Log the query for debugging
  // console.log('=== Debug Info for SQL Query ===');
  // console.log('Scope:', scope);
  // console.log('Query:', query.trim());
  // console.log('Company IDs:', companyIds);
  // console.log('Scope Value:', scopeValue);
  // console.log('=============================');

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
    const sessionId = input.sessionId || input.context?.sessionId;

    // Validate input parameters
    validateAnalystInput(input);

    // Log user message if we have one
    if (sessionId && input.context?.lastMessage) {
      console.log('About to log user message. SessionId:', sessionId);
      try {
        // Check if the session exists
        const { data: session, error: sessionError } = await supabase
          .from('conversation_sessions')
          .select('id')
          .eq('id', sessionId)
          .single();

        if (sessionError || !session) {
          // Create the session if it doesn't exist
          const { error: createError } = await supabase
            .from('conversation_sessions')
            .insert({
              id: sessionId,
              mode: 'analyst',
              status: 'active'
            });

          if (createError) {
            console.error('Error creating conversation session:', createError);
            throw createError;
          }
          console.log('Created new conversation session');
        }

        // Log the user message
        const { error: messageError } = await supabase
          .from('chat_messages')
          .insert({
            session_id: sessionId,
            sender: 'user',
            message: input.context.lastMessage
          });

        if (messageError) {
          console.error('Error logging user message:', messageError);
          throw messageError;
        }
        console.log('Successfully logged user message');
      } catch (error) {
        console.error('Error handling user message:', error);
      }
    }

    // Log starting analysis
    if (sessionId) {
      console.log('About to log analysis start message. SessionId:', sessionId);
      try {
        await logAgentResponse(
          supabase,
          sessionId,
          "I'm analyzing the capability data and preparing insights...",
          'mcp_analysis_start'
        );
        console.log('Successfully logged analysis start');
      } catch (error) {
        console.error('Error logging analysis start:', error);
      }
    } else {
      console.log('No sessionId provided, skipping chat message logging');
    }

    // Execute insight based on insightId
    if (input.insightId && input.context) {
      switch (input.insightId) {
        case 'generateCapabilityHeatmapByScope':
          if (!input.context.scope) {
            throw new Error('Scope is required for capability heatmap');
          }
          
          // Log data gathering
          if (sessionId) {
            console.log('About to log data gathering message. SessionId:', sessionId);
            try {
              await logAgentResponse(
                supabase,
                sessionId,
                "I'm gathering capability data across the organization...",
                'mcp_data_loaded'
              );
              console.log('Successfully logged data gathering');
            } catch (error) {
              console.error('Error logging data gathering:', error);
            }
          }
          
          try {
            data = await generateCapabilityHeatmapByScope(
              supabase,
              input.context.companyIds || [],
              input.context.scope,
              input.context.scopeValue
            );
            
            // Log data analysis
            if (sessionId) {
              try {
                await logAgentResponse(
                  supabase,
                  sessionId,
                  `I've analyzed the capability distribution data. Generating insights...`,
                  'mcp_analysis_complete'
                );
                console.log('Successfully logged analysis completion');
              } catch (error) {
                console.error('Error logging analysis completion:', error);
              }
            }
            
            actionsTaken.push('Generated capability heatmap');
          } catch (e) {
            console.error('Error generating capability heatmap:', e);
            throw new Error(`Failed to generate capability heatmap: ${e instanceof Error ? e.message : 'Unknown error'}`);
          }
          break;
          
        default:
          throw new Error(`Unsupported insight: ${input.insightId}`);
      }
    }

    // Generate chat response based on the data and format
    let promptResult;
    let chatResponse;
    let insightData = data;
    try {
      promptResult = await buildSafePrompt(
        'openai:gpt-4o' as ModelId,
        {
          systemPrompt: `You are an analyst helping interpret workforce capability data. 
The data shows capability distribution across ${input.context?.scope || 'the organization'}.
${input.context?.scopeValue ? `Focusing on: ${input.context.scopeValue}` : ''}
Format your response as ${input.context?.outputFormat || 'action_plan'}.

IMPORTANT: Format your response in markdown, using:
- Headers (##) for main sections
- Lists (- or 1.) for enumerated points
- **Bold** for emphasis on key metrics or findings
- Tables for structured data comparisons
- > Blockquotes for highlighting important insights
- Code blocks (\`\`) for specific metrics or data points`,
          data: data || {},
          context: {
            scope: input.context?.scope,
            scopeValue: input.context?.scopeValue,
            outputFormat: input.context?.outputFormat || 'action_plan'
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

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
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
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error?.message || 'Failed to generate insights from OpenAI API';
        
        // Log the API error to chat
        if (sessionId) {
          await logAgentResponse(
            supabase,
            sessionId,
            `I encountered an error while analyzing the data: ${errorMessage}`,
            'mcp_error'
          );
        }
        
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      chatResponse = responseData.choices?.[0]?.message?.content;

      if (!chatResponse) {
        const errorMessage = 'Invalid response format from OpenAI API';
        
        // Log the format error to chat
        if (sessionId) {
          await logAgentResponse(
            supabase,
            sessionId,
            `I encountered an error while processing the analysis: ${errorMessage}`,
            'mcp_error'
          );
        }
        
        throw new Error(errorMessage);
      }

      // Log final response to chat
      if (sessionId) {
        try {
          console.log('Attempting to log final response to chat:', {
            sessionId: sessionId,
            responseLength: chatResponse?.length || 0
          });
          
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
          
          console.log('Successfully logged final response to chat');
        } catch (error) {
          console.error('Error logging final response to chat:', error);
          // Don't throw here, we still want to return the response to the user
        }
      }

    } catch (e) {
      console.error('Error generating analysis:', e);
      chatResponse = 'I was unable to generate a detailed analysis, but I can show you the raw data.';
      promptResult = {
        system: '',
        user: '',
        metadata: {
          error: e instanceof Error ? e.message : 'Unknown error'
        }
      };

      // Log error to chat
      if (sessionId) {
        try {
          await logAgentResponse(
            supabase,
            sessionId,
            chatResponse,
            'mcp_error'
          );
          console.log('Successfully logged error to chat');
        } catch (error) {
          console.error('Error logging error message to chat:', error);
        }
      }
    }

    return {
      success: true,
      data: {
        matches: [],
        recommendations: [],
        insightData,
        chatResponse: {
          message: chatResponse,
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
      }
    };
  } catch (error) {
    console.error('Error in analyst loop:', error);

    // Log error to chat if we have a session
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
      error: error instanceof Error ? error.message : 'Unknown error',
      data: {
        matches: [],
        recommendations: [],
        insightData: null,
        chatResponse: {
          message: `I encountered an error while analyzing the data: ${error instanceof Error ? error.message : 'Unknown error'}`,
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