import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../../database.types.ts';
import { MCPActionV2, MCPResponse, MCPRequest } from '../../types/action.ts';
import { logAgentProgress } from '../../../chatUtils.ts';
import { getSemanticMatches } from '../../../embeddings.ts';
import { generateEmbedding } from '../../../semanticSearch.ts';
import { Tables } from '../../../embeddings.ts';
import { z } from "https://deno.land/x/zod/mod.ts";

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
  request: GetSemanticDiscoveryArgs
): Promise<SemanticMatch[]> {
  const supabase = request.supabase as SupabaseClient<Database>;
  const {
    queryText,
    targetTables = ['roles', 'capabilities', 'skills'],
    limit = 10,
    threshold = 0.6,
    sessionId
  } = request;

  try {
    // Generate embedding for the query text
    const queryEmbedding = await generateEmbedding(queryText);

    // Get matches for each target table
    const matchPromises = targetTables.map(async (table) => {
      const matches = await getSemanticMatches(supabase, {
        embedding: queryEmbedding,
        entityTypes: [table.slice(0, -1) as 'role' | 'skill' | 'capability' | 'company' | 'profile'],
        minScore: threshold,
        limit: Math.ceil(limit / targetTables.length),
        filters: {},
        companyId: undefined,
        perTypeLimit: Math.ceil(limit / targetTables.length)
      });
      return matches;
    });

    // Wait for all matches and flatten results
    const allMatches = (await Promise.all(matchPromises)).flat();

    // Sort by similarity and apply global limit
    return allMatches
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

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
  argsSchema: z.object({
    queryText: z.string().min(1, "Query text cannot be empty").describe("The text to search for matches"),
    targetTables: z.array(z.string()).optional(),
    limit: z.number().positive().optional(),
    threshold: z.number().min(0).max(1).optional()
  }),

  getDefaultArgs: (context) => ({
    queryText: context.lastMessage || '',
    targetTables: ['roles', 'capabilities', 'skills'],
    limit: 10,
    threshold: 0.6
  }),

  async actionFn(request): Promise<MCPResponse> {
    // Debug logging
    console.log('getSemanticDiscoveryMatches received request:', {
      hasArgs: !!request.args,
      args: request.args,
      queryText: request.args?.queryText,
      directQueryText: request.queryText,
      context: request.context,
      fullRequest: request
    });

    // Merge context and args, prioritizing args over context
    const mergedRequest = {
      ...request.context, // Start with context
      ...request, // Add base request properties
      ...request.args, // Override with args
      queryText: request.args?.queryText || request.queryText || request.context?.queryText // Explicit queryText handling
    };

    // Debug logging after merge
    console.log('getSemanticDiscoveryMatches after merge:', {
      mergedQueryText: mergedRequest.queryText,
      mergedRequest
    });

    const args = mergedRequest as GetSemanticDiscoveryArgs;
    const supabase = request.supabase as SupabaseClient<Database>;

    if (!args.queryText) {
      console.error('getSemanticDiscoveryMatches missing queryText:', {
        args,
        originalRequest: request,
        mergedRequest
      });
      return {
        success: false,
        error: {
          type: 'INVALID_INPUT',
          message: 'Query text is required',
          details: null
        }
      };
    }

    try {
      // Log starting discovery
      if (args.sessionId) {
        await logAgentProgress(
          supabase,
          args.sessionId,
          "I'm searching for relevant matches across the system...",
          { phase: 'semantic_discovery_start' }
        );
      }

      // Get semantic matches
      const matches = await getSemanticDiscoveryMatchesBase(args);

      // Log completion
      if (args.sessionId) {
        await logAgentProgress(
          supabase,
          args.sessionId,
          `Found ${matches.length} relevant matches.`,
          { phase: 'semantic_discovery_complete' }
        );
      }

      // Group matches by type for structured data
      const matchesByType = matches.reduce((acc, match) => {
        acc[match.type] = acc[match.type] || [];
        acc[match.type].push(match);
        return acc;
      }, {} as Record<string, SemanticMatch[]>);

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
            dataSummary: `Found ${matches.length} matches across ${Object.keys(matchesByType).length} entity types.`
          }
        }
      };

    } catch (error) {
      console.error('Error in getSemanticDiscoveryMatches:', error);
      
      if (args.sessionId) {
        await logAgentProgress(
          supabase,
          args.sessionId,
          "I encountered an error while searching for matches.",
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