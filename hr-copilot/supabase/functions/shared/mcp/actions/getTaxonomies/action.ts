import { z } from "https://deno.land/x/zod/mod.ts";
import { MCPActionV2, MCPResponse } from '../../types/action.ts';

const filtersSchema = z.object({
  roles: z.array(z.string().uuid()).optional(),
  skills: z.array(z.string().uuid()).optional(),
  companies: z.array(z.string().uuid()).optional(),
});

// Schema for action arguments
const argsSchema = z.object({
  group: z.string().optional()
    .describe("Taxonomy group to filter by (e.g. Policy, Delivery, Comms)"),
  searchTerm: z.string().optional()
    .describe("Search term to filter taxonomies by"),
  limit: z.number().optional()
    .describe("Number of results to return"),
  offset: z.number().optional()
    .describe("Offset for pagination"),
  filters: filtersSchema.optional()
    .describe("Additional filters for taxonomies"),
});

type Args = z.infer<typeof argsSchema>;

export const action: MCPActionV2 = {
  id: 'getTaxonomies',
  title: 'Get Taxonomies',
  description: 'Retrieve a list of taxonomies with optional filtering',
  applicableRoles: ['public', 'candidate', 'hiring', 'analyst'],
  capabilityTags: ['taxonomies', 'discovery'],
  requiredInputs: [],
  tags: ['taxonomies', 'search'],
  usesAI: false,
  argsSchema,

  getDefaultArgs: (context) => ({
    limit: 50,
    offset: 0
  }),

  actionFn: async (ctx: Record<string, any>): Promise<MCPResponse> => {
    try {
      const { supabase } = ctx;
      const args = ctx.args as Args;

      // Start with base query
      let query = supabase
        .from('taxonomies')
        .select(`
          *,
          role_taxonomies!inner (role:roles!inner(id, title)),
          skill_taxonomies!inner (skill:skills!inner(id, name))
        `);

      // Apply basic filters
      if (args.group) {
        query = query.eq('group', args.group);
      }
      if (args.searchTerm) {
        query = query.textSearch('search_vector', args.searchTerm);
      }

      // Apply additional filters if provided
      if (args.filters) {
        if (args.filters.roles?.length) {
          query = query.in('role_taxonomies.role_id', args.filters.roles);
        }
        if (args.filters.skills?.length) {
          query = query.in('skill_taxonomies.skill_id', args.filters.skills);
        }
        if (args.filters.companies?.length) {
          query = query.in('role_taxonomies.role.company_id', args.filters.companies);
        }
      }

      // Add pagination
      if (args.limit) {
        query = query.limit(args.limit);
      }
      if (typeof args.offset === 'number') {
        query = query.range(
          args.offset,
          args.offset + (args.limit || 50) - 1
        );
      }

      // Default ordering
      query = query.order('name', { ascending: true });

      const { data: taxonomies, error } = await query;
      if (error) throw error;

      // Transform the data to flatten the nested structure
      const transformedTaxonomies = taxonomies.map(taxonomy => ({
        ...taxonomy,
        roles: taxonomy.role_taxonomies?.map(r => r.role.title) || [],
        skills: taxonomy.skill_taxonomies?.map(s => s.skill.name) || [],
        // Remove the nested objects from the final response
        role_taxonomies: undefined,
        skill_taxonomies: undefined
      }));

      return {
        success: true,
        data: transformedTaxonomies,
        error: null,
        dataForDownstreamPrompt: {
          getTaxonomies: {
            dataSummary: `Retrieved ${transformedTaxonomies.length} taxonomies with applied filters`,
            structured: transformedTaxonomies,
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
          getTaxonomies: {
            dataSummary: `Error fetching taxonomies: ${error.message}`,
            structured: null,
            truncated: false
          }
        }
      };
    }
  }
}; 