import { ToolMetadataV2 } from '../types/action.ts';
import { ActionV2Registry } from './actionRegistry.ts';

/**
 * Mock tools for testing
 */
const mockTools: ToolMetadataV2[] = [
  {
    name: 'getCapabilityGaps',
    description: 'Analyzes capability gaps between profile and role',
    argsSchema: { 
      safeParse: (args) => {
        if (!args.profileId || !args.roleId) {
          return {
            success: false,
            error: { issues: ['Missing required args: profileId, roleId'] }
          };
        }
        return { success: true };
      }
    },
    requiredContext: ['profileId', 'roleId'],
    run: async ({ context, args }) => ({ gaps: ['Leadership', 'Project Management'] })
  },
  {
    name: 'getDevelopmentPlan',
    description: 'Creates a development plan based on gaps',
    argsSchema: { 
      safeParse: (args) => {
        if (!args.gaps || !Array.isArray(args.gaps)) {
          return {
            success: false,
            error: { issues: ['Missing or invalid gaps array'] }
          };
        }
        return { success: true };
      }
    },
    requiredContext: ['profileId'],
    run: async ({ context, args }) => ({ 
      recommendations: [
        { skill: 'Leadership', actions: ['Take leadership course', 'Lead small team projects'] },
        { skill: 'Project Management', actions: ['Get PM certification', 'Shadow senior PM'] }
      ]
    })
  },
  {
    name: 'getMatchingRolesForPerson',
    description: 'Finds matching roles for a person based on their profile',
    argsSchema: { 
      safeParse: (args) => {
        if (!args.profileId) {
          return {
            success: false,
            error: { issues: ['Missing required args: profileId'] }
          };
        }
        return { success: true };
      }
    },
    requiredContext: ['profileId'],
    run: async ({ context, args }) => ({
      matches: [
        { roleId: 'role1', title: 'Senior Manager', score: 0.85 },
        { roleId: 'role2', title: 'Project Lead', score: 0.75 }
      ]
    })
  },
  {
    name: 'getSemanticSkillRecommendations',
    description: 'Gets semantic skill recommendations based on role requirements',
    argsSchema: { 
      safeParse: (args) => {
        if (!args.roleId) {
          return {
            success: false,
            error: { issues: ['Missing required args: roleId'] }
          };
        }
        return { success: true };
      }
    },
    requiredContext: ['profileId'],
    run: async ({ context, args }) => ({
      recommendations: [
        { skill: 'Strategic Planning', relevance: 0.9 },
        { skill: 'Team Leadership', relevance: 0.85 }
      ]
    })
  }
];

/**
 * Setup test registry with mock tools
 */
export function setupTestRegistry() {
  ActionV2Registry.clear();
  mockTools.forEach(tool => ActionV2Registry.register(tool));
}

/**
 * Get mock tools for test assertions
 */
export function getMockTools(): ToolMetadataV2[] {
  return mockTools;
}

/**
 * Get mock plan for test assertions
 */
export function getMockPlan() {
  return [
    {
      tool: 'getCapabilityGaps',
      args: { profileId: '123', roleId: '456' }
    },
    {
      tool: 'getDevelopmentPlan',
      args: { gaps: ['Leadership', 'Project Management'] }
    },
    {
      tool: 'getSemanticSkillRecommendations',
      args: { roleId: '456' }
    }
  ];
} 