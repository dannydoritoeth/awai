import { z } from "https://deno.land/x/zod/mod.ts";
import { MCPActionV2, MCPRequest, MCPResponse } from '../../types/action.ts';

// Schema for action arguments
const argsSchema = z.object({
  fromRoleId: z.string().uuid()
    .describe("Current role ID"),
  toRoleId: z.string().uuid()
    .describe("Target role ID"),
  personId: z.string().uuid().optional()
    .describe("Person ID to check requirements against"),
  includeGapAnalysis: z.boolean().optional()
    .describe("Whether to include gap analysis")
});

type Args = z.infer<typeof argsSchema>;

export const getTransitionRequirements: MCPActionV2 = {
  id: 'getTransitionRequirements',
  title: 'Get Transition Requirements',
  description: 'Get requirements and gap analysis for a role transition',
  applicableRoles: ['public', 'candidate', 'hiring', 'analyst'],
  capabilityTags: ['roles', 'transitions'],
  requiredInputs: [],
  tags: ['roles', 'transitions', 'requirements'],
  usesAI: false,
  argsSchema,
  suggestedPrerequisites: ['getRole', 'getRoleTransitions'],
  suggestedPostrequisites: [],

  getDefaultArgs: (context) => ({
    includeGapAnalysis: true
  }),

  actionFn: async (ctx: Record<string, any>): Promise<MCPResponse> => {
    try {
      const { supabase } = ctx;
      const args = ctx.args as Args;

      // Get the transition if it exists
      const { data: transition, error: transitionError } = await supabase
        .from('role_transitions')
        .select(`
          *,
          transition_type:transition_types(id, name, description),
          requirements:role_transition_requirements(
            requirement:transition_requirements(id, name, description, requirement_type),
            required_level,
            is_mandatory
          )
        `)
        .eq('from_role_id', args.fromRoleId)
        .eq('to_role_id', args.toRoleId)
        .single();

      if (transitionError) throw transitionError;

      // Get both roles' details
      const [fromRole, toRole] = await Promise.all([
        supabase
          .from('roles')
          .select(`
            *,
            division:divisions(id, name),
            skills:role_skills(skill:skills(id, name, category)),
            capabilities:role_capabilities(capability:capabilities(id, name, type, level))
          `)
          .eq('id', args.fromRoleId)
          .single(),
        supabase
          .from('roles')
          .select(`
            *,
            division:divisions(id, name),
            skills:role_skills(skill:skills(id, name, category)),
            capabilities:role_capabilities(capability:capabilities(id, name, type, level))
          `)
          .eq('id', args.toRoleId)
          .single()
      ]);

      if (fromRole.error) throw fromRole.error;
      if (toRole.error) throw toRole.error;

      // Calculate skill and capability gaps
      const gaps = {
        skills: calculateSkillGaps(fromRole.data, toRole.data),
        capabilities: calculateCapabilityGaps(fromRole.data, toRole.data)
      };

      // If person ID is provided, analyze their current status against requirements
      let personAnalysis = null;
      if (args.personId) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select(`
            *,
            skills:profile_skills(skill:skills(id, name, category), level),
            capabilities:profile_capabilities(capability:capabilities(id, name, type, level), level),
            qualifications:profile_qualifications(qualification:qualifications(id, name, type))
          `)
          .eq('id', args.personId)
          .single();

        if (profileError) throw profileError;

        personAnalysis = analyzePersonRequirements(profile, transition, gaps);
      }

      const response = {
        transition,
        fromRole: fromRole.data,
        toRole: toRole.data,
        gaps,
        personAnalysis
      };

      return {
        success: true,
        data: response,
        error: null,
        dataForDownstreamPrompt: {
          getTransitionRequirements: {
            dataSummary: `Analyzed requirements for transition from ${fromRole.data.title} to ${toRole.data.title}`,
            structured: response,
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
          getTransitionRequirements: {
            dataSummary: `Error analyzing transition requirements: ${error.message}`,
            structured: null,
            truncated: false
          }
        }
      };
    }
  }
};

// Helper function to calculate skill gaps
function calculateSkillGaps(fromRole: any, toRole: any) {
  const fromSkills = new Map(fromRole.skills.map((s: any) => [s.skill.id, s.skill]));
  const toSkills = new Map(toRole.skills.map((s: any) => [s.skill.id, s.skill]));

  return {
    new: Array.from(toSkills.values())
      .filter(skill => !fromSkills.has(skill.id))
      .map(skill => ({
        id: skill.id,
        name: skill.name,
        category: skill.category
      })),
    transferable: Array.from(toSkills.values())
      .filter(skill => fromSkills.has(skill.id))
      .map(skill => ({
        id: skill.id,
        name: skill.name,
        category: skill.category
      }))
  };
}

// Helper function to calculate capability gaps
function calculateCapabilityGaps(fromRole: any, toRole: any) {
  const fromCaps = new Map(fromRole.capabilities.map((c: any) => [c.capability.id, c]));
  const toCaps = new Map(toRole.capabilities.map((c: any) => [c.capability.id, c]));

  return {
    new: Array.from(toCaps.values())
      .filter(cap => !fromCaps.has(cap.capability.id))
      .map(cap => ({
        id: cap.capability.id,
        name: cap.capability.name,
        type: cap.capability.type,
        level: cap.capability.level
      })),
    upgrade: Array.from(toCaps.values())
      .filter(cap => {
        const fromCap = fromCaps.get(cap.capability.id);
        return fromCap && fromCap.capability.level < cap.capability.level;
      })
      .map(cap => ({
        id: cap.capability.id,
        name: cap.capability.name,
        type: cap.capability.type,
        fromLevel: fromCaps.get(cap.capability.id).capability.level,
        toLevel: cap.capability.level
      }))
  };
}

// Helper function to analyze person's current status against requirements
function analyzePersonRequirements(profile: any, transition: any, gaps: any) {
  const personSkills = new Map(profile.skills.map((s: any) => [s.skill.id, s]));
  const personCaps = new Map(profile.capabilities.map((c: any) => [c.capability.id, c]));
  const personQuals = new Set(profile.qualifications.map((q: any) => q.qualification.id));

  return {
    skills: {
      met: gaps.skills.new.filter((s: any) => personSkills.has(s.id)),
      missing: gaps.skills.new.filter((s: any) => !personSkills.has(s.id))
    },
    capabilities: {
      met: gaps.capabilities.new.filter((c: any) => personCaps.has(c.id)),
      needsUpgrade: gaps.capabilities.upgrade.filter((c: any) => {
        const personCap = personCaps.get(c.id);
        return personCap && personCap.level < c.toLevel;
      }),
      missing: gaps.capabilities.new.filter((c: any) => !personCaps.has(c.id))
    },
    requirements: transition.requirements.map((r: any) => ({
      ...r.requirement,
      required_level: r.required_level,
      is_mandatory: r.is_mandatory,
      is_met: r.requirement.requirement_type === 'qualification'
        ? personQuals.has(r.requirement.id)
        : false // Other requirement types would need specific logic
    }))
  };
} 