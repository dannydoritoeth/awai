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
  size = 'medium'
}: ActionButtonProps): string {
  const actionBlock = {
    label,
    actionId,
    params,
    variant,
    size
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
 * Helper function to render common action patterns
 */
export const ActionButtons = {
  /**
   * Renders a "Learn More" button for a specific role
   */
  learnMoreAboutRole: (roleId: string, roleTitle: string) => renderMarkdownActionButton({
    label: `Learn More About ${roleTitle}`,
    actionId: 'getRoleDetails',
    params: { roleId },
    variant: 'primary',
    size: 'medium'
  }),

  /**
   * Renders a "View Capability Gaps" button for a profile and role
   */
  viewCapabilityGaps: (profileId: string, roleId: string) => renderMarkdownActionButton({
    label: 'View Capability Gaps',
    actionId: 'getCapabilityGaps',
    params: { profileId, roleId },
    variant: 'primary',
    size: 'medium'
  }),

  /**
   * Renders a "Get Development Plan" button for a profile and role
   */
  getDevelopmentPlan: (profileId: string, roleId: string) => renderMarkdownActionButton({
    label: 'Get Development Plan',
    actionId: 'getDevelopmentPlan',
    params: { profileId, roleId },
    variant: 'primary',
    size: 'medium'
  }),

  /**
   * Renders a set of common role exploration buttons
   */
  roleExplorationSet: (profileId: string, roleId: string, roleTitle: string) => renderMarkdownActionButtons([
    {
      label: `Learn More About ${roleTitle}`,
      actionId: 'getRoleDetails',
      params: { roleId },
      variant: 'primary',
      size: 'medium'
    },
    {
      label: 'View Capability Gaps',
      actionId: 'getCapabilityGaps',
      params: { profileId, roleId },
      variant: 'secondary',
      size: 'medium'
    },
    {
      label: 'Get Development Plan',
      actionId: 'getDevelopmentPlan',
      params: { profileId, roleId },
      variant: 'outline',
      size: 'medium'
    }
  ])
}; 