/**
 * Renders a markdown block containing an action button that can be parsed by the frontend
 * and rendered as an interactive button to trigger MCPActionV2 actions.
 */
export interface ActionButtonProps {
  /** The text to display on the button */
  label: string;
  /** The ID of the MCPActionV2 action to trigger */
  actionId: string;
  /** Parameters to pass to the action */
  params: Record<string, any>;
  /** Optional variant for styling (default is 'primary') */
  variant?: 'primary' | 'secondary' | 'outline';
  /** Optional size for the button (default is 'medium') */
  size?: 'small' | 'medium' | 'large';
  /** Optional group ID to group related actions */
  groupId?: string;
}

/**
 * Interface for a group of related actions
 */
export interface ActionButtonGroup {
  /** Unique identifier for the group */
  groupId: string;
  /** Actions in this group */
  actions: ActionButtonProps[];
}

/**
 * Generates a markdown code block that will be rendered as an action button
 * by the frontend.
 * 
 * @example
 * ```typescript
 * const md = renderMarkdownActionButton({
 *   label: "View Capability Gaps",
 *   actionId: "getCapabilityGaps",
 *   params: {
 *     profileId: "abc123",
 *     roleId: "r1"
 *   }
 * });
 * ```
 */
export function renderMarkdownActionButton({
  label,
  actionId,
  params,
  variant = 'primary',
  size = 'medium',
  groupId
}: ActionButtonProps): string {
  const actionBlock = {
    label,
    actionId,
    params,
    variant,
    size,
    ...(groupId && { groupId })
  };

  return `\`\`\`action
${JSON.stringify(actionBlock, null, 2)}
\`\`\``;
}

/**
 * Helper function to render multiple action buttons in a row
 */
export function renderMarkdownActionButtons(buttons: ActionButtonProps[]): string {
  return buttons.map(button => renderMarkdownActionButton(button)).join('\n\n');
}

/**
 * Helper function to render a group of related actions as a dropdown
 */
export function renderMarkdownActionGroup(group: ActionButtonGroup): string {
  const actionsWithGroup = group.actions.map(action => ({
    ...action,
    groupId: group.groupId
  }));

  return `\`\`\`action
${JSON.stringify(actionsWithGroup, null, 2)}
\`\`\``;
}

/**
 * Helper function to render multiple action groups
 */
export function renderMarkdownActionGroups(groups: ActionButtonGroup[]): string {
  return groups.map(group => renderMarkdownActionGroup(group)).join('\n\n');
}

/**
 * Helper function to render common action patterns
 */
export const ActionButtons = {
  /**
   * Renders a "Learn More" button for a specific role
   */
  learnMoreAboutRole: (roleId: string, roleTitle: string) => renderMarkdownActionButton({
    label: `Learn More About ${roleTitle}`,
    actionId: 'getRoleDetails',
    params: { roleId, roleTitle },
    variant: 'primary',
    size: 'medium'
  }),

  /**
   * Renders a "View Capability Gaps" button for a profile and role
   */
  viewCapabilityGaps: (profileId: string, roleId: string, roleTitle: string) => renderMarkdownActionButton({
    label: 'View Capability Gaps',
    actionId: 'getCapabilityGaps',
    params: { profileId, roleId, roleTitle },
    variant: 'primary',
    size: 'medium'
  }),

    /**
   * Renders a "View Capability Gaps" button for a profile and role
   */
  viewSemanticSkillRecommendations: (profileId: string, roleId: string, roleTitle: string) => renderMarkdownActionButton({
    label: 'View Skill Recommendations',
    actionId: 'getSemanticSkillRecommendations',
    params: { profileId, roleId, roleTitle },
    variant: 'primary',
    size: 'medium'
  }),
  

  /**
   * Renders a "Get Development Plan" button for a profile and role
   */
  getDevelopmentPlan: (profileId: string, roleId: string, roleTitle: string) => renderMarkdownActionButton({
    label: 'Get Development Plan',
    actionId: 'getDevelopmentPlan',
    params: { profileId, roleId, roleTitle },
    variant: 'primary',
    size: 'medium'
  }),

  /**
   * Renders a set of common role exploration buttons as individual buttons
   */
  roleExplorationSet: (profileId: string, roleId: string, roleTitle: string) => renderMarkdownActionButtons([
    {
      label: `Learn More About ${roleTitle}`,
      actionId: 'getRoleDetails',
      params: { roleId, roleTitle },
      variant: 'primary',
      size: 'medium'
    },
    {
      label: 'View Capability Gaps',
      actionId: 'getCapabilityGaps',
      params: { profileId, roleId, roleTitle },
      variant: 'secondary',
      size: 'medium'
    },
    {
      label: 'View Skill Recommendations',
      actionId: 'getSemanticSkillRecommendations',
      params: { profileId, roleId, roleTitle },
      variant: 'secondary',
      size: 'medium'
    },
    {
      label: 'Get Development Plan',
      actionId: 'getDevelopmentPlan',
      params: { profileId, roleId, roleTitle },
      variant: 'outline',
      size: 'medium'
    }
  ]),

  /**
   * Renders a set of common profile exploration buttons as a grouped dropdown
   * Used when starting from a role context and exploring matching profiles
   */
  profileExplorationGroup: (profileId: string, roleId: string, profileName: string, profileData?: {
    profileId: string;
    name: string;
    semanticScore: number;
    currentRole?: string;
    department?: string;
  }) => renderMarkdownActionGroup({
    groupId: `profile_${profileId}`,
    actions: [
      {
        label: `Learn More`,
        actionId: 'getProfileContext',
        params: { 
          profileId,
          profileName: profileData?.name || profileName
        },
        variant: 'primary',
        size: 'medium'
      },
      {
        label: 'Explain Match',
        actionId: 'explainMatch',
        params: { 
          profileId,
          roleId,
          profileName: profileData?.name || profileName
        },
        variant: 'secondary',
        size: 'medium'
      },
      {
        label: 'View Capability Gaps',
        actionId: 'getCapabilityGaps',
        params: { 
          profileId,
          roleId,
          profileName: profileData?.name || profileName
        },
        variant: 'secondary',
        size: 'medium'
      },
      {
        label: 'View Skill Recommendations',
        actionId: 'getSemanticSkillRecommendations',
        params: { 
          profileId,
          roleId,
          profileName: profileData?.name || profileName
        },
        variant: 'secondary',
        size: 'medium'
      },
      {
        label: 'Get Readiness Assessment',
        actionId: 'getReadinessAssessment',
        params: { 
          profileId,
          roleId,
          profileName: profileData?.name || profileName
        },
        variant: 'secondary',
        size: 'medium'
      },
      {
        label: 'Get Development Plan',
        actionId: 'getDevelopmentPlan',
        params: { 
          profileId,
          roleId,
          profileName: profileData?.name || profileName
        },
        variant: 'outline',
        size: 'medium'
      }
    ]
  }),

  /**
   * Renders a set of common role exploration buttons as a grouped dropdown
   * Used when starting from a profile context and exploring matching roles
   */
  roleExplorationGroup: (profileId: string, roleId: string, roleTitle: string, roleData?: {
    roleId: string;
    title: string;
    semanticScore: number;
    department?: string;
  }) => renderMarkdownActionGroup({
    groupId: `role_${roleId}`,
    actions: [
      {
        label: `Learn More`,
        actionId: 'getRoleDetails',
        params: { 
          roleId,
          roleTitle: roleData?.title || roleTitle
        },
        variant: 'primary',
        size: 'medium'
      },
      {
        label: 'Explain Match',
        actionId: 'explainMatch',
        params: { 
          profileId,
          roleId,
          roleTitle: roleData?.title || roleTitle
        },
        variant: 'secondary',
        size: 'medium'
      },
      {
        label: 'View Capability Gaps',
        actionId: 'getCapabilityGaps',
        params: { 
          profileId,
          roleId,
          roleTitle: roleData?.title || roleTitle
        },
        variant: 'secondary',
        size: 'medium'
      },
      {
        label: 'View Skill Recommendations',
        actionId: 'getSemanticSkillRecommendations',
        params: { 
          profileId,
          roleId,
          roleTitle: roleData?.title || roleTitle
        },
        variant: 'secondary',
        size: 'medium'
      },
      {
        label: 'Get Readiness Assessment',
        actionId: 'getReadinessAssessment',
        params: { 
          profileId,
          roleId,
          roleTitle: roleData?.title || roleTitle
        },
        variant: 'secondary',
        size: 'medium'
      },
      {
        label: 'Get Development Plan',
        actionId: 'getDevelopmentPlan',
        params: { 
          profileId,
          roleId,
          roleTitle: roleData?.title || roleTitle
        },
        variant: 'outline',
        size: 'medium'
      }
    ]
  })
}; 