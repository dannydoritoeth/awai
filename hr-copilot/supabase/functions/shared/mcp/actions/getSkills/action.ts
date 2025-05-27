import { z } from "https://deno.land/x/zod/mod.ts";
import { MCPActionV2, MCPResponse } from '../../types/action.ts';

const filtersSchema = z.object({
  taxonomies: z.array(z.string().uuid()).optional(),
  roles: z.array(z.string().uuid()).optional(),
  capabilities: z.array(z.string().uuid()).optional(),
  companies: z.array(z.string().uuid()).optional(),
});

// Schema for action arguments
const argsSchema = z.object({
  category: z.string().optional()
    .describe("Skill category to filter by"),
  searchTerm: z.string().optional()
    .describe("Search term to filter skills by"),
  limit: z.number().optional()
    .describe("Number of results to return"),
  offset: z.number().optional()
    .describe("Offset for pagination"),
  filters: filtersSchema.optional()
    .describe("Additional filters for skills"),
});

type Args = z.infer<typeof argsSchema>;

export const action: MCPActionV2 = {
  id: 'getSkills',
  title: 'Get Skills',
  description: 'Retrieve a list of skills with optional filtering',
  applicableRoles: ['public', 'candidate', 'hiring', 'analyst'],
  capabilityTags: ['skills', 'discovery'],
  requiredInputs: [],
  tags: ['skills', 'search'],
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
        .from('skills')
        .select(`
          *,
          skill_taxonomies!inner (taxonomy:taxonomies!inner(id, name)),
          role_skills!inner (role:roles!inner(id, title)),
          skill_capabilities!inner (capability:capabilities!inner(id, name))
        `);

      // Apply basic filters
      if (args.category) {
        query = query.eq('category', args.category);
      }
      if (args.searchTerm) {
        query = query.textSearch('search_vector', args.searchTerm);
      }

      // Apply additional filters if provided
      if (args.filters) {
        if (args.filters.taxonomies?.length) {
          query = query.in('skill_taxonomies.taxonomy_id', args.filters.taxonomies);
        }
        if (args.filters.roles?.length) {
          query = query.in('role_skills.role_id', args.filters.roles);
        }
        if (args.filters.capabilities?.length) {
          query = query.in('skill_capabilities.capability_id', args.filters.capabilities);
        }
        if (args.filters.companies?.length) {
          query = query.in('role_skills.role.company_id', args.filters.companies);
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

      const { data: skills, error } = await query;
      if (error) throw error;

      // Transform the data to flatten the nested structure
      const transformedSkills = skills.map(skill => ({
        ...skill,
        taxonomies: skill.skill_taxonomies?.map(t => t.taxonomy.name) || [],
        roles: skill.role_skills?.map(r => r.role.title) || [],
        capabilities: skill.skill_capabilities?.map(c => c.capability.name) || [],
        // Remove the nested objects from the final response
        skill_taxonomies: undefined,
        role_skills: undefined,
        skill_capabilities: undefined
      }));

      return {
        success: true,
        data: transformedSkills,
        error: null,
        dataForDownstreamPrompt: {
          getSkills: {
            dataSummary: `Retrieved ${transformedSkills.length} skills with applied filters`,
            structured: transformedSkills,
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
          getSkills: {
            dataSummary: `Error fetching skills: ${error.message}`,
            structured: null,
            truncated: false
          }
        }
      };
    }
  }
}; 