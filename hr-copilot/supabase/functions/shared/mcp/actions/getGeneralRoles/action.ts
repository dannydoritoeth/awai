import { z } from "https://deno.land/x/zod/mod.ts";
import { MCPActionV2, MCPRequest, MCPResponse } from '../../types/action.ts';

const filtersSchema = z.object({
  taxonomies: z.array(z.string().uuid()).optional(),
  regions: z.array(z.string().uuid()).optional(),
  divisions: z.array(z.string().uuid()).optional(),
  employmentTypes: z.array(z.string().uuid()).optional(),
  capabilities: z.array(z.string().uuid()).optional(),
  skills: z.array(z.string().uuid()).optional(),
  companies: z.array(z.string().uuid()).optional(),
});

// Schema for action arguments
const argsSchema = z.object({
  functionArea: z.string().optional()
    .describe("Function area to filter by"),
  classificationLevel: z.string().optional()
    .describe("Classification level to filter by"),
  searchTerm: z.string().optional()
    .describe("Search term to filter roles by"),
  limit: z.number().optional()
    .describe("Number of results to return"),
  offset: z.number().optional()
    .describe("Offset for pagination"),
  filters: filtersSchema.optional()
    .describe("Additional filters for roles"),
});

type Args = z.infer<typeof argsSchema>;

export const getGeneralRoles: MCPActionV2 = {
  id: 'getGeneralRoles',
  title: 'Get General Roles',
  description: 'Retrieve a list of general roles with optional filtering',
  applicableRoles: ['public', 'candidate', 'hiring', 'analyst'],
  capabilityTags: ['roles', 'discovery'],
  requiredInputs: [],
  tags: ['roles', 'search'],
  usesAI: false,
  argsSchema,
  suggestedPrerequisites: [],
  suggestedPostrequisites: ['getSpecificRole', 'getCapabilityGaps'],

  getDefaultArgs: (context) => ({
    limit: 10,
    offset: 0
  }),

  actionFn: async (ctx: Record<string, any>): Promise<MCPResponse> => {
    try {
      const { supabase } = ctx;
      const args = ctx.args as Args;

      // Start with base query
      let query = supabase
        .from('general_roles')
        .select(`
          *,
          role_taxonomies!inner (taxonomy:taxonomies!inner(id, name)),
          role_regions!inner (region:regions!inner(id, name)),
          role_divisions!inner (division:divisions!inner(id, name)),
          role_employment_types!inner (employment_type:employment_types!inner(id, type)),
          role_capabilities!inner (capability:capabilities!inner(id, name)),
          role_skills!inner (skill:skills!inner(id, name)),
          role_companies!inner (company:companies!inner(id, name))
        `);

      // Apply basic filters
      if (args.functionArea) {
        query = query.eq('function_area', args.functionArea);
      }
      if (args.classificationLevel) {
        query = query.eq('classification_level', args.classificationLevel);
      }
      if (args.searchTerm) {
        query = query.textSearch('search_vector', args.searchTerm);
      }

      // Apply additional filters if provided
      if (args.filters) {
        if (args.filters.taxonomies?.length) {
          query = query.in('role_taxonomies.taxonomy_id', args.filters.taxonomies);
        }
        if (args.filters.regions?.length) {
          query = query.in('role_regions.region_id', args.filters.regions);
        }
        if (args.filters.divisions?.length) {
          query = query.in('role_divisions.division_id', args.filters.divisions);
        }
        if (args.filters.employmentTypes?.length) {
          query = query.in('role_employment_types.employment_type_id', args.filters.employmentTypes);
        }
        if (args.filters.capabilities?.length) {
          query = query.in('role_capabilities.capability_id', args.filters.capabilities);
        }
        if (args.filters.skills?.length) {
          query = query.in('role_skills.skill_id', args.filters.skills);
        }
        if (args.filters.companies?.length) {
          query = query.in('role_companies.company_id', args.filters.companies);
        }
      }

      // Add pagination
      if (args.limit) {
        query = query.limit(args.limit);
      }
      if (typeof args.offset === 'number') {
        query = query.range(
          args.offset,
          args.offset + (args.limit || 10) - 1
        );
      }

      // Default ordering
      query = query.order('title', { ascending: true });

      const { data: roles, error } = await query;
      if (error) throw error;

      // Transform the data to flatten the nested structure
      const transformedRoles = roles.map(role => ({
        ...role,
        taxonomies: role.role_taxonomies?.map(t => t.taxonomy.name) || [],
        regions: role.role_regions?.map(r => r.region.name) || [],
        divisions: role.role_divisions?.map(d => d.division.name) || [],
        employmentTypes: role.role_employment_types?.map(e => e.employment_type.type) || [],
        capabilities: role.role_capabilities?.map(c => c.capability.name) || [],
        skills: role.role_skills?.map(s => s.skill.name) || [],
        companies: role.role_companies?.map(c => c.company.name) || [],
        // Remove the nested objects from the final response
        role_taxonomies: undefined,
        role_regions: undefined,
        role_divisions: undefined,
        role_employment_types: undefined,
        role_capabilities: undefined,
        role_skills: undefined,
        role_companies: undefined
      }));

      return {
        success: true,
        data: transformedRoles,
        error: null,
        dataForDownstreamPrompt: {
          getGeneralRoles: {
            dataSummary: `Retrieved ${transformedRoles.length} roles with applied filters`,
            structured: transformedRoles,
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
            dataSummary: `Error fetching roles: ${error.message}`,
            structured: null,
            truncated: false
          }
        }
      };
    }
  }
}; 