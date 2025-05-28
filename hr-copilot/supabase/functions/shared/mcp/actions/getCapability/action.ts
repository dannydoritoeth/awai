import { z } from "https://deno.land/x/zod/mod.ts";
import { MCPActionV2, MCPResponse } from '../../types/action.ts';

// Schema for action arguments
const argsSchema = z.object({
  id: z.string().uuid()
    .describe("ID of the capability to retrieve"),
});

type Args = z.infer<typeof argsSchema>;

export const action: MCPActionV2 = {
  id: 'getCapability',
  title: 'Get Capability',
  description: 'Retrieve detailed information about a specific capability',
  applicableRoles: ['public', 'candidate', 'hiring', 'analyst'],
  capabilityTags: ['capabilities', 'discovery'],
  requiredInputs: ['id'],
  tags: ['capabilities', 'search'],
  usesAI: false,
  argsSchema,

  actionFn: async (ctx: Record<string, any>): Promise<MCPResponse> => {
    try {
      const { supabase } = ctx;
      const args = ctx.args as Args;

      // Get the capability with related data
      const { data: capability, error } = await supabase
        .from('capabilities')
        .select(`
          *,
          role_capabilities!inner (
            role:roles!inner(id, title),
            level
          )
        `)
        .eq('id', args.id)
        .single();

      if (error) throw error;

      // Transform the data to include roles that require this capability
      const roles = capability.role_capabilities.map((rc: any) => ({
        id: rc.role.id,
        title: rc.role.title,
        required_level: rc.level
      }));

      // Remove the nested data from the response
      const { role_capabilities, ...capabilityData } = capability;

      return {
        success: true,
        data: {
          ...capabilityData,
          roles
        },
        error: null,
        dataForDownstreamPrompt: {
          getCapability: {
            dataSummary: `Retrieved capability: ${capability.name} with ${roles.length} related roles`,
            structured: {
              capability: capabilityData,
              roles
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
          getCapability: {
            dataSummary: `Error fetching capability: ${error.message}`,
            structured: null,
            truncated: false
          }
        }
      };
    }
  }
}; 