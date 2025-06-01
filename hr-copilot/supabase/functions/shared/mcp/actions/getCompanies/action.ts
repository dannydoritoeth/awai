import { z } from "https://deno.land/x/zod/mod.ts";
import { MCPActionV2, MCPResponse } from '../../types/action.ts';

const filtersSchema = z.object({
  divisions: z.array(z.string().uuid()).optional(),
  roles: z.array(z.string().uuid()).optional(),
  taxonomies: z.array(z.string().uuid()).optional(),
  regions: z.array(z.string().uuid()).optional(),
});

// Schema for action arguments
const argsSchema = z.object({
  searchTerm: z.string().optional()
    .describe("Search term to filter companies by"),
  limit: z.number().optional()
    .describe("Number of results to return"),
  offset: z.number().optional()
    .describe("Offset for pagination"),
  filters: filtersSchema.optional()
    .describe("Additional filters for companies"),
});

type Args = z.infer<typeof argsSchema>;

export const action: MCPActionV2 = {
  id: 'getCompanies',
  title: 'Get Companies',
  description: 'Retrieve a list of companies with optional filtering',
  applicableRoles: ['public', 'candidate', 'hiring', 'analyst'],
  capabilityTags: ['companies', 'discovery'],
  requiredInputs: [],
  tags: ['companies', 'search'],
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
        .from('companies')
        .select(`
          *,
          company_divisions!inner (division:divisions!inner(id, name)),
          roles!inner (id, title),
          role_taxonomies!inner (taxonomy:taxonomies!inner(id, name)),
          role_regions!inner (region:regions!inner(id, name))
        `);

      // Apply search filter if provided
      if (args.searchTerm) {
        query = query.textSearch('search_vector', args.searchTerm);
      }

      // Apply additional filters if provided
      if (args.filters) {
        if (args.filters.divisions?.length) {
          query = query.in('company_divisions.division_id', args.filters.divisions);
        }
        if (args.filters.roles?.length) {
          query = query.in('roles.id', args.filters.roles);
        }
        if (args.filters.taxonomies?.length) {
          query = query.in('role_taxonomies.taxonomy_id', args.filters.taxonomies);
        }
        if (args.filters.regions?.length) {
          query = query.in('role_regions.region_id', args.filters.regions);
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

      const { data: companies, error } = await query;
      if (error) throw error;

      // Transform the data to flatten the nested structure
      const transformedCompanies = companies.map(company => ({
        ...company,
        divisions: company.company_divisions?.map(d => d.division.name) || [],
        roles: company.roles?.map(r => r.title) || [],
        taxonomies: company.role_taxonomies?.map(t => t.taxonomy.name) || [],
        regions: company.role_regions?.map(r => r.region.name) || [],
        // Remove the nested objects from the final response
        company_divisions: undefined,
        roles: undefined,
        role_taxonomies: undefined,
        role_regions: undefined
      }));

      return {
        success: true,
        data: transformedCompanies,
        error: null,
        dataForDownstreamPrompt: {
          getCompanies: {
            dataSummary: `Retrieved ${transformedCompanies.length} companies with applied filters`,
            structured: transformedCompanies,
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
          getCompanies: {
            dataSummary: `Error fetching companies: ${error.message}`,
            structured: null,
            truncated: false
          }
        }
      };
    }
  }
}; 