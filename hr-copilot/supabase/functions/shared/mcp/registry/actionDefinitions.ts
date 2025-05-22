/**
 * Interface for MCP action metadata
 */
export interface MCPActionMetadata {
  id: string;
  role: 'candidate' | 'hiring' | 'analyst' | 'general';
  description: string;
  requiresProfileId?: boolean;
  requiresRoleId?: boolean;
  requiresJobId?: boolean;
  requiresCompanyId?: boolean;
  requiresEmbedding?: boolean;
  requiresEntityTypes?: boolean;
  requiresEntityType?: boolean;
  requiresEntityId?: boolean;
  requiresActionType?: boolean;
  requiresChatContext?: boolean;
  requiresText?: boolean;
}

/**
 * Registry of all MCP actions with their metadata
 */
export const MCP_ACTIONS: Record<string, MCPActionMetadata> = {
  // Candidate Actions
  getProfileContext: {
    id: 'getProfileContext',
    role: 'candidate',
    description: 'Load profile details and embedding',
    requiresProfileId: true
  },
  getSuggestedCareerPaths: {
    id: 'getSuggestedCareerPaths',
    role: 'candidate',
    description: 'Recommend future roles based on profile',
    requiresProfileId: true
  },
  getJobReadiness: {
    id: 'getJobReadiness',
    role: 'candidate',
    description: 'Score profile readiness for a job',
    requiresProfileId: true,
    requiresJobId: true
  },
  getOpenJobs: {
    id: 'getOpenJobs',
    role: 'candidate',
    description: 'Get list of available job opportunities'
  },
  getCapabilityGaps: {
    id: 'getCapabilityGaps',
    role: 'candidate',
    description: 'Compare profile capabilities to a role',
    requiresProfileId: true,
    requiresRoleId: true
  },
  getSkillGaps: {
    id: 'getSkillGaps',
    role: 'candidate',
    description: 'Compare profile skills to a role',
    requiresProfileId: true,
    requiresRoleId: true
  },
  getSemanticSkillRecommendations: {
    id: 'getSemanticSkillRecommendations',
    role: 'candidate',
    description: 'Suggest skill improvements via embeddings',
    requiresProfileId: true
  },

  // Hiring Actions
  getRoleDetail: {
    id: 'getRoleDetail',
    role: 'hiring',
    description: 'Load role details and embedding',
    requiresRoleId: true
  },
  getMatchingProfiles: {
    id: 'getMatchingProfiles',
    role: 'hiring',
    description: 'Find profiles that match role requirements',
    requiresRoleId: true
  },
  scoreProfileFit: {
    id: 'scoreProfileFit',
    role: 'hiring',
    description: 'Calculate fit score for a specific profile',
    requiresProfileId: true,
    requiresRoleId: true
  },
  scoreProfilesToRoleFit: {
    id: 'scoreProfilesToRoleFit',
    role: 'hiring',
    description: 'Score how well multiple profiles match a role',
    requiresProfileId: true,
    requiresRoleId: true
  },
  scoreRolesToProfileFit: {
    id: 'scoreRolesToProfileFit',
    role: 'candidate',
    description: 'Score how well multiple roles match a profile',
    requiresProfileId: true,
    requiresRoleId: true
  },
  getSemanticCompanyFit: {
    id: 'getSemanticCompanyFit',
    role: 'hiring',
    description: 'Compare profile to company/division embedding',
    requiresProfileId: true,
    requiresCompanyId: true
  },

  // Analyst Actions
  generateCapabilityHeatmapByTaxonomy: {
    id: 'generateCapabilityHeatmapByTaxonomy',
    role: 'analyst',
    description: 'Generate capability heatmap analysis by taxonomy groups',
    requiresCompanyId: true
  },
  generateCapabilityHeatmapByDivision: {
    id: 'generateCapabilityHeatmapByDivision',
    role: 'analyst',
    description: 'Generate capability heatmap analysis by divisions',
    requiresCompanyId: true
  },
  generateCapabilityHeatmapByRegion: {
    id: 'generateCapabilityHeatmapByRegion',
    role: 'analyst',
    description: 'Generate capability heatmap analysis by regions',
    requiresCompanyId: true
  },
  generateCapabilityHeatmapByCompany: {
    id: 'generateCapabilityHeatmapByCompany',
    role: 'analyst',
    description: 'Generate capability heatmap analysis by company',
    requiresCompanyId: true
  },

  // Shared Actions
  getSemanticMatches: {
    id: 'getSemanticMatches',
    role: 'general',
    description: 'Find semantically similar entities across the system',
    requiresEmbedding: true,
    requiresEntityTypes: true
  },
  embedContext: {
    id: 'embedContext',
    role: 'general',
    description: 'Generate and store an embedding',
    requiresEntityType: true,
    requiresEntityId: true
  },
  handleChatInteraction: {
    id: 'handleChatInteraction',
    role: 'general',
    description: 'Process chat interactions',
    requiresChatContext: true
  },
  nudge: {
    id: 'nudge',
    role: 'general',
    description: 'Send a system-generated prompt',
    requiresProfileId: true,
    requiresActionType: true
  }
}; 