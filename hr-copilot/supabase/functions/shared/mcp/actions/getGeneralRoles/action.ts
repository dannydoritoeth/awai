import { z } from "https://deno.land/x/zod/mod.ts";
import { MCPActionV2, MCPRequest, MCPResponse } from '../../types/action.ts';

// Schema for action arguments
const argsSchema = z.object({
  id: z.string().uuid().optional()
    .describe("UUID of specific general role to fetch"),
  functionArea: z.string().optional()
    .describe("Filter by function area"),
  classificationLevel: z.string().optional()
    .describe("Filter by classification level"),
  searchTerm: z.string().optional()
    .describe("Text to search across role fields"),
  limit: z.number().positive().optional()
    .describe("Maximum number of results to return"),
  offset: z.number().min(0).optional()
    .describe("Number of results to skip for pagination")
});

type Args = z.infer<typeof argsSchema>;

export const getGeneralRoles: MCPActionV2 = {
  id: 'getGeneralRoles',
  title: 'Get General Roles',
  description: 'Retrieve general roles with optional filtering and search',
  applicableRoles: ['public', 'candidate', 'hiring', 'analyst'],
  capabilityTags: ['roles', 'discovery'],
  requiredInputs: [],
  tags: ['roles', 'search', 'filter'],
  usesAI: false,
  argsSchema,
  suggestedPrerequisites: [],
  suggestedPostrequisites: ['getRoleDetails', 'getCapabilityGaps'],

  getDefaultArgs: (context) => ({
    limit: 10,
    offset: 0
  }),

  actionFn: async (ctx: Record<string, any>): Promise<MCPResponse> => {
    try {
      const { supabase } = ctx;
      const args = ctx.args as Args;

      let query = supabase
        .from('general_roles')
        .select('*');

      // Apply filters
      if (args?.id) {
        query = query.eq('id', args.id);
      }
      if (args?.functionArea) {
        query = query.eq('function_area', args.functionArea);
      }
      if (args?.classificationLevel) {
        query = query.eq('classification_level', args.classificationLevel);
      }
      if (args?.searchTerm) {
        query = query.textSearch('search_vector', args.searchTerm);
      }

      // Add pagination
      if (args?.limit) {
        query = query.limit(args.limit);
      }
      if (typeof args?.offset === 'number') {
        query = query.range(
          args.offset,
          args.offset + (args.limit || 10) - 1
        );
      }

      // Default ordering
      query = query.order('title', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        data,
        error: error ? { type: 'DatabaseError', message: error.message } : undefined,
        dataForDownstreamPrompt: {
          getGeneralRoles: {
            dataSummary: data ? `Found ${data.length} general roles` : 'No roles found',
            structured: data,
            truncated: false
          }
        }
      };

    } catch (error) {
      return {
        success: false,
        data: null,
        error: {
          type: 'ActionError',
          message: error.message
        },
        dataForDownstreamPrompt: {
          getGeneralRoles: {
            dataSummary: `Error fetching general roles: ${error.message}`,
            structured: null,
            truncated: false
          }
        }
      };
    }
  }
}; 