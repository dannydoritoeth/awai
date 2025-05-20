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
 * - Understand relationships between them (e.g. recommendedBefore/After)
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
import { getRoleDetails } from './getRoleDetails/action.ts';
// import { getSuggestedCareerPaths } from './getSuggestedCareerPaths/action.ts';
import { MCPActionV2, ToolMetadataV2 } from '../types/action.ts';


const capabilityGapsSchema = z.object({
  profileId: z.string(),
  roleId: z.string()
});

const actions: MCPActionV2[] = [
  getCapabilityGaps,
  getDevelopmentPlan,
  getMatchingRolesForPerson,
  getSemanticSkillRecommendations,
  getRoleDetails
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
        const after = a.recommendedAfter?.length ? a.recommendedAfter.join(', ') : 'none';
        const before = a.recommendedBefore?.length ? a.recommendedBefore.join(', ') : 'none';
        return `- ${a.id}: ${a.description}\n  Recommended After: ${after}\n  Recommended Before: ${before}`;
      })
    ].join('\n\n');
  }

  /**
   * Returns only metadata used for listing actions in tools format (e.g. for tool calling)
   */
  static getToolMetadataList(): { name: string; description: string; argsSchema: z.ZodTypeAny; run: (input: { context: Record<string, any>; args: Record<string, any>; }) => Promise<any> }[] {
    return actions.map(a => ({
      name: a.id,
      description: a.description ?? '',
      argsSchema: a.argsSchema ?? z.object({}),
      run: async ({ context, args }) => a.actionFn({ ...context, ...args })
    }));
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
  static getTool(name: string): { name: string; description: string; argsSchema: z.ZodTypeAny; run: (input: { context: Record<string, any>; args: Record<string, any>; }) => Promise<any>; requiredContext?: string[] } | undefined {
    const action = actions.find(a => a.id === name);
    if (!action) return undefined;

    return {
      name: action.id,
      description: action.description ?? '',
      argsSchema: action.argsSchema ?? z.object({}),
      run: async ({ context, args }) => action.actionFn({ ...context, ...args }),
      requiredContext: action.requiredInputs
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
}
