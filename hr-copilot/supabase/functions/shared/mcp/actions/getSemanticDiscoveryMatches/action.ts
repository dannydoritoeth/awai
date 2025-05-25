import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../../database.types.ts';
import { MCPActionV2, MCPResponse, MCPRequest } from '../../types/action.ts';
import { logAgentProgress } from '../../../chatUtils.ts';
import { getSemanticMatches } from '../../../semanticSearch.ts';
import { generateEmbedding } from '../../../semanticSearch.ts';
import { Tables } from '../../../embeddings.ts';
import { z } from "https://deno.land/x/zod/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// Define SemanticMatch interface locally since it's not exported
interface SemanticMatch {
  id: string;
  type: 'role' | 'skill' | 'capability' | 'company' | 'profile';
  name: string;
  similarity: number;
  metadata?: any;
}

interface GetSemanticDiscoveryArgs extends MCPRequest {
  queryText: string;
  targetTables?: Tables[];
  limit?: number;
  threshold?: number;
}

export async function getSemanticDiscoveryMatchesBase(
  request: MCPRequest & GetSemanticDiscoveryArgs
): Promise<SemanticMatch[]> {
  // Ensure we have a valid Supabase client
  if (!request.supabase?.rpc) {
    console.error('Invalid or missing Supabase client');
    throw new Error('Invalid or missing Supabase client');
  }

  const supabase = request.supabase as SupabaseClient<Database>;
  console.log('Supabase client check:', {
    hasSupabase: !!supabase,
    hasRpc: !!(supabase?.rpc),
    clientMethods: Object.keys(supabase || {})
  });

  const {
    queryText,
    targetTables = ['roles', 'capabilities', 'skills'],
    limit = 10,
    threshold = 0.6
  } = request;

  try {
    // Generate embedding for the query text
    console.log('Generating embedding for query:', { queryText });
    const queryEmbedding = await generateEmbedding(queryText);
    console.log('Generated embedding:', {
      type: typeof queryEmbedding,
      isArray: Array.isArray(queryEmbedding),
      length: Array.isArray(queryEmbedding) ? queryEmbedding.length : null,
      sample: Array.isArray(queryEmbedding) ? queryEmbedding.slice(0, 3) : queryEmbedding
    });

    // Get matches for each target table
    const matchPromises = targetTables.map(async (table) => {
      console.log('Getting matches for table:', {
        table,
        embeddingFormat: {
          type: typeof queryEmbedding,
          isArray: Array.isArray(queryEmbedding),
          length: Array.isArray(queryEmbedding) ? queryEmbedding.length : null
        },
        supabaseCheck: {
          hasSupabase: !!supabase,
          hasRpc: !!(supabase?.rpc),
          clientMethods: Object.keys(supabase || {})
        }
      });

      try {
        // Create a new Supabase client if the existing one is invalid
        const effectiveSupabase = supabase?.rpc ? supabase : createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        );

        const matches = await getSemanticMatches(effectiveSupabase, {
          embedding: queryEmbedding,
          entityTypes: [table.slice(0, -1) as 'role' | 'skill' | 'capability' | 'company' | 'profile'],
          limit: Math.ceil(limit / targetTables.length),
          minScore: threshold
        });
        console.log('Matches result:', {
          table,
          matchCount: matches.length,
          firstMatch: matches[0]
        });
        return matches;
      } catch (error) {
        console.error('Error getting matches for table:', {
          table,
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
          supabaseState: {
            hasSupabase: !!supabase,
            hasRpc: !!(supabase?.rpc),
            clientMethods: Object.keys(supabase || {})
          }
        });
        throw error;
      }
    });

    // Wait for all matches and flatten results
    const allMatches = (await Promise.all(matchPromises)).flat();

    // Sort by similarity and apply global limit
    return allMatches
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    // Log progress if we have a session
    if (request.sessionId) {
      await logAgentProgress(
        supabase,
        request.sessionId,
        aiResponse.output,
        { 
          phase: 'complete',
          analysisDetails: {
            message: aiResponse.output
          }
        }
      );
    }

  } catch (error) {
    console.error('Error in getSemanticDiscoveryMatchesBase:', error);
    throw error;
  }
}

export const getSemanticDiscoveryMatches: MCPActionV2 = {
  id: 'getSemanticDiscoveryMatches',
  title: 'Get Semantic Discovery Matches',
  description: 'Find roles, skills, capabilities, or profiles similar to a user query using vector search.',
  applicableRoles: ['general'],
  capabilityTags: ['Discovery', 'Exploration', 'Vector Search'],
  requiredInputs: ['queryText'],
  tags: ['discovery', 'general', 'semantic', 'no_context'],
  suggestedPrerequisites: [],
  suggestedPostrequisites: [],
  usesAI: false,
  
  // Define expected arguments with Zod
  argsSchema: z.object({
    queryText: z.string().min(1, "Query text cannot be empty")
      .describe("The text to search for matches"),
    targetTables: z.array(z.string()).optional()
      .describe("Which tables to search in"),
    limit: z.number().positive().optional()
      .describe("Maximum number of results to return"),
    threshold: z.number().min(0).max(1).optional()
      .describe("Minimum similarity threshold")
  }),

  // Provide sensible defaults
  getDefaultArgs: (context = {}) => ({
    queryText: context?.lastMessage || '',
    targetTables: ['roles', 'capabilities', 'skills'],
    limit: 10,
    threshold: 0.6
  }),

  async actionFn(request): Promise<MCPResponse> {
    console.log('Action: Initial request:', {
      hasArgs: !!request.args,
      args: request.args,
      providedArgs: request.providedArgs,
      directArgs: request,
      context: request.context,
      hasSupabase: !!request.supabase,
      supabaseMethods: request.supabase ? Object.keys(request.supabase) : [],
      stack: new Error().stack
    });

    // Log default args computation
    const defaultArgs = this.getDefaultArgs?.(request.context);
    console.log('Action: Default args:', {
      defaultArgs,
      context: request.context
    });

    // Try to get args from various possible locations
    const args = {
      ...defaultArgs,
      ...(request.args || {}),
      ...(request.providedArgs || {}),
      // If args aren't in request.args, try to get them from request directly
      ...((!request.args && request.queryText) ? {
        queryText: request.queryText,
        targetTables: request.targetTables,
        limit: request.limit,
        threshold: request.threshold
      } : {}),
      // Ensure supabase client is passed through
      supabase: request.supabase
    };

    // Log final args after merging
    console.log('Action: Final args:', {
      args,
      hasQueryText: !!args.queryText,
      queryTextSource: args.queryText ? 'merged' : 'missing',
      finalQueryText: args.queryText,
      hasSupabase: !!args.supabase,
      supabaseMethods: args.supabase ? Object.keys(args.supabase) : []
    });

    if (!args.queryText) {
      const error = {
        type: 'INVALID_INPUT',
        message: 'Query text is required',
        details: {
          providedArgs: args,
          defaultArgs,
          context: request.context
        }
      };
      console.error('Action: Missing queryText:', error);
      return {
        success: false,
        error
      };
    }

    try {
      // Log starting discovery
      if (request.sessionId) {
        await logAgentProgress(
          request.supabase,
          request.sessionId,
          "# Semantic Discovery Search\n\n🔍 Searching for relevant matches across the system...",
          { phase: 'semantic_discovery_start' }
        );
      }

      // Get semantic matches
      const matches = await getSemanticDiscoveryMatchesBase({
        ...request,
        ...args
      });

      // Format matches into markdown
      const matchesByType = matches.reduce((acc, match) => {
        acc[match.type] = acc[match.type] || [];
        acc[match.type].push(match);
        return acc;
      }, {} as Record<string, SemanticMatch[]>);

      // Create markdown summary
      const markdownSummary = [
        `# Search Results Summary\n`,
        `Found **${matches.length}** relevant matches across **${Object.keys(matchesByType).length}** categories.\n`,
        ...Object.entries(matchesByType).map(([type, typeMatches]) => (
          `## ${type.charAt(0).toUpperCase() + type.slice(1)}s\n` +
          typeMatches.map(match => 
            `- **${match.name}** (Similarity: ${(match.similarity * 100).toFixed(1)}%)`
          ).join('\n')
        ))
      ].join('\n');

      // Log completion with markdown
      if (request.sessionId) {
        await logAgentProgress(
          request.supabase,
          request.sessionId,
          markdownSummary,
          { 
            phase: 'semantic_discovery_complete',
            analysisDetails: {
              totalMatches: matches.length,
              matchesByType: matchesByType
            }
          }
        );
      }

      return {
        success: true,
        data: matches,
        dataForDownstreamPrompt: {
          getSemanticDiscoveryMatches: {
            truncated: false,
            structured: {
              totalMatches: matches.length,
              matchesByType: matchesByType,
              topMatch: matches[0]
            },
            dataSummary: markdownSummary
          }
        }
      };

    } catch (error) {
      console.error('Error in getSemanticDiscoveryMatches:', error);
      
      if (request.sessionId) {
        await logAgentProgress(
          request.supabase,
          request.sessionId,
          "# Error\n\n❌ I encountered an error while searching for matches.\n\n```\n" + 
          (error instanceof Error ? error.message : 'Unknown error') +
          "\n```",
          { phase: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
        );
      }

      return {
        success: false,
        error: {
          type: 'DISCOVERY_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: error
        }
      };
    }
  }
}; 