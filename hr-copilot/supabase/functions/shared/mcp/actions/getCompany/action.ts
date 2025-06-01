import { z } from "https://deno.land/x/zod/mod.ts";
import { MCPActionV2, MCPRequest, MCPResponse } from '../../types/action.ts';

export const actionId = 'getCompany';

// Define the args schema
export const argsSchema = z.object({
  companyId: z.string().uuid("Must be a valid UUID"),
  includeDivisions: z.boolean().optional().default(false),
  includeRoles: z.boolean().optional().default(false)
});

type Args = z.infer<typeof argsSchema>;

export const action: MCPActionV2 = {
  id: actionId,
  title: "Get Company Details",
  description: "Retrieve detailed information about a specific company",
  applicableRoles: ["general"],
  capabilityTags: ["Company Management"],
  tags: ["companies", "details"],
  usesAI: false,
  argsSchema,
  requiredInputs: ["companyId"],

  getDefaultArgs: (context): Partial<Args> => ({
    includeDivisions: false,
    includeRoles: false
  }),

  actionFn: async (ctx: Record<string, any>): Promise<MCPResponse> => {
    const args = argsSchema.parse(ctx.args || {});
    const { supabase } = ctx;

    // Start with base company query
    let query = supabase
      .from('companies')
      .select('*')
      .eq('id', args.companyId)
      .single();

    const { data: company, error } = await query;

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    if (!company) {
      return {
        success: false,
        error: 'Company not found'
      };
    }

    // Get additional data if requested
    const additionalData: Record<string, any> = {};

    if (args.includeDivisions) {
      const { data: divisions } = await supabase
        .from('company_divisions')
        .select('*')
        .eq('company_id', args.companyId);
      additionalData.divisions = divisions || [];
    }

    if (args.includeRoles) {
      const { data: roles } = await supabase
        .from('roles')
        .select('*')
        .eq('company_id', args.companyId);
      additionalData.roles = roles || [];
    }

    return {
      success: true,
      data: {
        ...company,
        ...additionalData
      }
    };
  }
}; 