import { z } from "https://deno.land/x/zod/mod.ts";
import { MCPActionV2, MCPRequest, MCPResponse } from '../../types/action.ts';

// Schema for action arguments
const argsSchema = z.object({
  roleId: z.string().uuid()
    .describe("UUID of the actual role to fetch"),
  includeSkills: z.boolean().optional()
    .describe("Whether to include related skills"),
  includeCapabilities: z.boolean().optional()
    .describe("Whether to include related capabilities"),
  includeDocuments: z.boolean().optional()
    .describe("Whether to include related documents"),
});

type Args = z.infer<typeof argsSchema>;

export const getRole: MCPActionV2 = {
  id: 'getRole',
  title: 'Get Role',
  description: 'Retrieve a specific company role with its details and optional related data',
  applicableRoles: ['public', 'candidate', 'hiring', 'analyst'],
  capabilityTags: ['roles', 'discovery'],
  requiredInputs: ['roleId'],
  tags: ['roles', 'search'],
  usesAI: false,
  argsSchema,
  suggestedPrerequisites: ['getGeneralRoles'],
  suggestedPostrequisites: ['getCapabilityGaps'],

  getDefaultArgs: (context) => ({
    includeSkills: true,
    includeCapabilities: true,
    includeDocuments: true
  }),

  actionFn: async (ctx: Record<string, any>): Promise<MCPResponse> => {
    try {
      const { supabase } = ctx;
      const args = ctx.args as Args;

      // Base role query
      let query = supabase
        .from('roles')
        .select(`
          *,
          division:divisions(
            id,
            name,
            cluster,
            agency
          )
        `)
        .eq('id', args.roleId)
        .single();

      // Get role data
      const { data: role, error: roleError } = await query;
      if (roleError) throw roleError;

      // Get related data if requested
      const relatedData: Record<string, any> = {};

      if (args.includeSkills) {
        const { data: skills, error: skillsError } = await supabase
          .from('role_skills')
          .select(`
            skills (
              id,
              name,
              category,
              description
            )
          `)
          .eq('role_id', args.roleId);
        
        if (skillsError) throw skillsError;
        relatedData.skills = skills?.map(s => s.skills) || [];
      }

      if (args.includeCapabilities) {
        const { data: capabilities, error: capsError } = await supabase
          .from('role_capabilities')
          .select(`
            capabilities (
              id,
              name,
              group_name,
              description
            ),
            capability_type,
            level
          `)
          .eq('role_id', args.roleId);
        
        if (capsError) throw capsError;
        relatedData.capabilities = capabilities?.map(c => ({
          ...c.capabilities,
          type: c.capability_type,
          level: c.level
        })) || [];
      }

      if (args.includeDocuments) {
        const { data: documents, error: docsError } = await supabase
          .from('role_documents')
          .select('*')
          .eq('role_id', args.roleId);
        
        if (docsError) throw docsError;
        relatedData.documents = documents || [];
      }

      return {
        success: true,
        data: {
          role,
          ...relatedData
        },
        error: null,
        dataForDownstreamPrompt: {
          getRole: {
            dataSummary: `Retrieved role: ${role.title} with ${Object.keys(relatedData).join(', ')}`,
            structured: {
              role,
              ...relatedData
            },
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
          getRole: {
            dataSummary: `Error fetching role: ${error.message}`,
            structured: null,
            truncated: false
          }
        }
      };
    }
  }
}; 