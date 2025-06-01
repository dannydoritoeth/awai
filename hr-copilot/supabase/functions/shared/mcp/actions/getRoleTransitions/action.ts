import { z } from "https://deno.land/x/zod/mod.ts";
import { MCPActionV2, MCPRequest, MCPResponse } from '../../types/action.ts';

const filtersSchema = z.object({
  transitionTypes: z.array(z.string().uuid()).optional(),
  status: z.array(z.string()).optional(),
  dateRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }).optional()
});

// Schema for action arguments
const argsSchema = z.object({
  roleId: z.string().uuid()
    .describe("Role ID to get transitions for"),
  direction: z.enum(['from', 'to', 'both']).optional()
    .describe("Direction of transitions to fetch"),
  includeRequirements: z.boolean().optional()
    .describe("Whether to include transition requirements"),
  includeHistory: z.boolean().optional()
    .describe("Whether to include transition history"),
  limit: z.number().optional()
    .describe("Number of results to return"),
  offset: z.number().optional()
    .describe("Offset for pagination"),
  filters: filtersSchema.optional()
    .describe("Additional filters for transitions")
});

type Args = z.infer<typeof argsSchema>;

export const getRoleTransitions: MCPActionV2 = {
  id: 'getRoleTransitions',
  title: 'Get Role Transitions',
  description: 'Retrieve role transitions with optional filtering',
  applicableRoles: ['public', 'candidate', 'hiring', 'analyst'],
  capabilityTags: ['roles', 'transitions'],
  requiredInputs: [],
  tags: ['roles', 'transitions', 'search'],
  usesAI: false,
  argsSchema,
  suggestedPrerequisites: ['getRole'],
  suggestedPostrequisites: ['getPossibleTransitions', 'getTransitionRequirements'],

  getDefaultArgs: (context) => ({
    direction: 'both',
    includeRequirements: false,
    includeHistory: false,
    limit: 10,
    offset: 0
  }),

  actionFn: async (ctx: Record<string, any>): Promise<MCPResponse> => {
    try {
      const { supabase } = ctx;
      const args = ctx.args as Args;

      // Start with base query for role transitions
      let query = supabase
        .from('role_transitions')
        .select(`
          *,
          transition_type:transition_types(id, name, description),
          from_role:roles!from_role_id(id, title, division:divisions(id, name)),
          to_role:roles!to_role_id(id, title, division:divisions(id, name))
          ${args.includeRequirements ? `,
            requirements:role_transition_requirements(
              requirement:transition_requirements(id, name, description, requirement_type),
              required_level,
              is_mandatory
            )
          ` : ''}
        `);

      // Apply direction filter
      if (args.direction === 'from') {
        query = query.eq('from_role_id', args.roleId);
      } else if (args.direction === 'to') {
        query = query.eq('to_role_id', args.roleId);
      } else {
        query = query.or(`from_role_id.eq.${args.roleId},to_role_id.eq.${args.roleId}`);
      }

      // Apply additional filters if provided
      if (args.filters) {
        if (args.filters.transitionTypes?.length) {
          query = query.in('transition_type_id', args.filters.transitionTypes);
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
      query = query.order('frequency', { ascending: false });

      const { data: transitions, error: transitionsError } = await query;
      if (transitionsError) throw transitionsError;

      // Fetch transition history if requested
      let history = null;
      if (args.includeHistory) {
        const { data: historyData, error: historyError } = await supabase
          .from('transition_history')
          .select(`
            *,
            transition_type:transition_types(id, name),
            from_role:roles!from_role_id(id, title, division:divisions(id, name)),
            to_role:roles!to_role_id(id, title, division:divisions(id, name))
          `)
          .or(`from_role_id.eq.${args.roleId},to_role_id.eq.${args.roleId}`)
          .order('start_date', { ascending: false });

        if (historyError) throw historyError;
        history = historyData;
      }

      return {
        success: true,
        data: {
          transitions,
          history
        },
        error: null,
        dataForDownstreamPrompt: {
          getRoleTransitions: {
            dataSummary: `Retrieved ${transitions.length} transitions${history ? ` and ${history.length} history records` : ''} for role ${args.roleId}`,
            structured: {
              transitions,
              history
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
          getRoleTransitions: {
            dataSummary: `Error fetching transitions: ${error.message}`,
            structured: null,
            truncated: false
          }
        }
      };
    }
  }
}; 