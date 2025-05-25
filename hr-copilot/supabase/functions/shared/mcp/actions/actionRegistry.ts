// actionV2Registry.ts

/*
 * This registry holds all MCPActionV2 definitions used by the MCP loop planner and executor.
 *
 * Each action:
 * - Encapsulates a modular, named function representing a step in the career intelligence system
 * - Includes metadata to help the planner determine sequencing, roles, required inputs, and use of AI
 * - Optionally includes a Zod schema for runtime validation of inputs
 *
 * The planner accesses this registry to:
 * - Discover available actions
 * - Understand relationships between them (e.g. suggestedPostrequisites/After)
 * - Present descriptions in prompt-friendly formats
 *
 * The loop uses this registry to:
 * - Validate and invoke actions dynamically
 * - Ensure required inputs are present and valid
 */

import { z } from "https://deno.land/x/zod/mod.ts";
import { getCapabilityGaps } from './getCapabilityGaps/action.ts';
import { getDevelopmentPlan } from './getDevelopmentPlan/action.ts';
import { getMatchingRolesForPerson } from './getMatchingRolesForPerson/action.ts';
import { getSemanticSkillRecommendations } from './getSemanticSkillRecommendations/action.ts';
import { getSkillGaps } from './getSkillGaps/action.ts';
import { getRoleDetails } from './getRoleDetails/action.ts';
import { getMatchingPeopleForRole } from './getMatchingPeopleForRole/action.ts';
import { scoreProfilesToRoleFit } from './scoreProfilesToRoleFit/action.ts';
import { scoreRolesToProfileFit } from './scoreRolesToProfileFit/action.ts';
import { getReadinessAssessment } from './getReadinessAssessment/action.ts';
import { recommendAlternateCareerPaths } from './recommendAlternateCareerPaths/action.ts';
import { recommendSuccessors } from './recommendSuccessors/action.ts';
import { generateCapabilityHeatmapByTaxonomy } from './generateCapabilityHeatmapByTaxonomy/action.ts';
import { generateCapabilityHeatmapByDivision } from './generateCapabilityHeatmapByDivision/action.ts';
import { generateCapabilityHeatmapByRegion } from './generateCapabilityHeatmapByRegion/action.ts';
import { generateCapabilityHeatmapByCompany } from './generateCapabilityHeatmapByCompany/action.ts';
// import { summarizeCapabilityHeatmap } from './summarizeCapabilityHeatmap/action.ts';
// import { generateCapabilityInsights } from './generateCapabilityInsights/action.ts';
import { getProfileContextAction } from './getProfileContext/action.ts';
import { explainMatch } from './explainMatch/action.ts';
import { getSemanticDiscoveryMatches } from './getSemanticDiscoveryMatches/action.ts';
// import { getSuggestedCareerPaths } from './getSuggestedCareerPaths/action.ts';
import { MCPActionV2, ToolMetadataV2 } from '../types/action.ts';

const semanticDiscoverySchema = z.object({
  queryText: z.string().min(1, "Query text cannot be empty").describe("The text to search for matches"),
  targetTables: z.array(z.string()).optional(),
  limit: z.number().positive().optional(),
  threshold: z.number().min(0).max(1).optional()
});

// Update getSemanticDiscoveryMatches to include the schema
const getSemanticDiscoveryMatchesWithMeta = {
  ...getSemanticDiscoveryMatches,
  requiredContext: [], // No shared context required
  requiredArgs: ['queryText'], // queryText should be in args
  // Add validation wrapper
  actionFn: async (request) => {
    console.log('Registry: Pre-validation state:', {
      hasArgs: !!request.args,
      args: request.args,
      context: request.context,
      requiredContext: [],
      requiredArgs: ['queryText'],
      argsSchema: getSemanticDiscoveryMatches.argsSchema?.toString(),
    });

    // Log schema validation if present
    if (getSemanticDiscoveryMatches.argsSchema) {
      const schemaValidation = getSemanticDiscoveryMatches.argsSchema.safeParse(request.args || {});
      console.log('Registry: Schema validation result:', {
        success: schemaValidation.success,
        error: !schemaValidation.success ? schemaValidation.error : undefined
      });
    }

    return getSemanticDiscoveryMatches.actionFn(request);
  }
};

const actions: MCPActionV2[] = [
  getCapabilityGaps,
  getDevelopmentPlan,
  getMatchingRolesForPerson,
  getSemanticSkillRecommendations,
  getSkillGaps,
  getRoleDetails,
  getMatchingPeopleForRole,
  scoreProfilesToRoleFit,
  scoreRolesToProfileFit,
  getReadinessAssessment,
  recommendAlternateCareerPaths,
  recommendSuccessors,
  generateCapabilityHeatmapByTaxonomy,
  generateCapabilityHeatmapByDivision,
  generateCapabilityHeatmapByRegion,
  generateCapabilityHeatmapByCompany,
  // summarizeCapabilityHeatmap,
  // generateCapabilityInsights,
  getProfileContextAction,
  explainMatch,
  getSemanticDiscoveryMatchesWithMeta
//   getSuggestedCareerPaths
];

/**
 * Registry for MCP V2 actions/tools
 */
export class ActionV2Registry {
  private static tools: Map<string, ToolMetadataV2> = new Map();

  /**
   * Register a new tool
   */
  static register(tool: ToolMetadataV2) {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} is already registered`);
    }
    this.tools.set(tool.name, tool);
  }


  /**
   * Clear all registered tools (mainly for testing)
   */
  static clear() {
    this.tools.clear();
  }

  /**
   * Returns a full prompt including descriptions and recommended order
   * for use by the planner model.
   */
  static buildPlannerPromptWithPathways(): string {
    return [
      'Available Actions:',
      ...actions.map(a => {
        const after = a.suggestedPrerequisites?.length ? a.suggestedPrerequisites.join(', ') : 'none';
        const before = a.suggestedPostrequisites?.length ? a.suggestedPostrequisites.join(', ') : 'none';
        return `- ${a.id}: ${a.description}\n  Recommended After: ${after}\n  Recommended Before: ${before}`;
      })
    ].join('\n\n');
  }

  /**
   * Returns only metadata used for listing actions in tools format (e.g. for tool calling)
   */
  static getToolMetadataList(): ToolMetadataV2[] {
    return actions.map(a => {
      // Get any additional metadata from wrapped actions
      const meta = {
        requiredContext: [],
        requiredArgs: [],
        ...a
      };

      return {
        name: a.id,
        title: a.title,
        description: a.description ?? '',
        argsSchema: a.argsSchema ?? z.object({}),
        run: async ({ context, args }) => a.actionFn({ ...context, ...args }),
        suggestedPrerequisites: a.suggestedPrerequisites,
        suggestedPostrequisites: a.suggestedPostrequisites,
        requiredPrerequisites: a.requiredPrerequisites,
        applicableRoles: a.applicableRoles,
        capabilityTags: a.capabilityTags,
        // Use requiredContext/Args from meta instead of requiredInputs for validation
        requiredContext: meta.requiredContext || [],
        // Keep requiredInputs for backward compatibility and AI guidance
        requiredInputs: meta.requiredArgs || a.requiredInputs || [],
        tags: a.tags,
        usesAI: a.usesAI
      };
    });
  }

  /**
   * Returns all actions that include a given tag.
   */
  static getByTag(tag: string): MCPActionV2[] {
    return actions.filter(a => a.tags?.includes(tag) ?? false);
  }

  /**
   * Returns all registered actions.
   */
  static list(): MCPActionV2[] {
    return actions;
  }

  /**
   * Returns an action by ID.
   */
  static get(id: string): MCPActionV2 | undefined {
    return actions.find((a) => a.id === id);
  }

  /**
   * Returns true if the action ID is registered.
   */
  static has(id: string): boolean {
    return actions.some((a) => a.id === id);
  }

  /**
   * Filters actions by their applicable role types.
   */
  static getApplicable(role: string): MCPActionV2[] {
    return actions.filter((a) => a.applicableRoles.includes(role));
  }

  /**
   * Simple prompt description (no ordering).
   */
  static getDescriptionsForPlannerPrompt(): string {
    return actions.map((a) => `- ${a.id}: ${a.description}`).join('\n');
  }

  /**
   * Validates inputs using Zod if available, otherwise falls back to checking required keys.
   */
  static validateInputs(id: string, ctx: Record<string, any>): { valid: boolean; missing: string[] } {
    const action = ActionV2Registry.get(id);
    if (!action) return { valid: false, missing: ['Action not found'] };

    if (action.argsSchema) {
      const result = action.argsSchema.safeParse(ctx);
      return {
        valid: result.success,
        missing: result.success ? [] : result.error.errors.map(e => e.path.join('.'))
      };
    }

    const missing = action.requiredInputs.filter((key) => ctx[key] === undefined);
    return { valid: missing.length === 0, missing };
  }

  /**
   * Returns a tool by name in the tool metadata format
   */
  static getTool(name: string): { 
    name: string; 
    description: string; 
    argsSchema: z.ZodTypeAny; 
    run: (input: { context: Record<string, any>; args: Record<string, any>; }) => Promise<any>;
    requiredContext?: string[];
    requiredArgs?: string[];
  } | undefined {
    const action = actions.find(a => a.id === name);
    if (!action) return undefined;

    // Get any additional metadata from wrapped actions
    const meta = {
      requiredContext: [],
      requiredArgs: [],
      ...action
    };

    // If no explicit requiredArgs/Context is set, map requiredInputs to requiredArgs
    const mappedArgs = meta.requiredArgs?.length ? meta.requiredArgs : action.requiredInputs || [];

    return {
      name: action.id,
      description: action.description ?? '',
      argsSchema: action.argsSchema ?? z.object({}),
      run: async ({ context, args }) => action.actionFn({ ...context, ...args }),
      requiredContext: meta.requiredContext || [], // Should be empty unless explicitly set
      requiredArgs: mappedArgs // Use mapped args
    };
  }

  /**
   * Loads a tool with its metadata and merged default args
   */
  static loadToolWithArgs(name: string, context: Record<string, any>, providedArgs?: Record<string, any>): { 
    tool: { 
      name: string; 
      description: string; 
      argsSchema: z.ZodTypeAny; 
      run: (input: { context: Record<string, any>; args: Record<string, any>; }) => Promise<any>;
      requiredContext?: string[];
    }; 
    args: Record<string, any>;
  } | undefined {
    // Get tool metadata
    const tool = this.getTool(name);
    if (!tool) return undefined;

    // Get action implementation for default args
    const actionImpl = this.get(name);
    const defaultArgs = actionImpl?.getDefaultArgs?.(context) || {};

    // Merge args with defaults
    const mergedArgs = {
      ...defaultArgs,
      ...(providedArgs || {}) // Provided args override defaults
    };

    return {
      tool,
      args: mergedArgs
    };
  }

  // Add logging to validateAction method
  static validateAction(action, context) {
    console.log('Registry: validateAction called:', {
      actionId: action.tool,
      context: context,
      tool: this.getTool(action.tool)
    });
    return this.validateInputs(action.tool, context);
  }
}
