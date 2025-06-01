import { RoleData, ProfileData } from '../types/data';

interface ActionParams {
  actionId: string;
  params: {
    roleId?: string;
    roleTitle?: string;
    profileId?: string;
    profileName?: string;
    matchPercentage?: number;
    matchStatus?: string;
    [key: string]: unknown;
  };
  label?: string;
}

export function generateActionMessage(
  action: ActionParams,
  roleData?: RoleData | null,
  profileData?: ProfileData | null
): { message: string; actionId: string } {
  // Get profile name from context or params
  const resolvedProfileName = roleData 
    ? action.params.profileName 
    : profileData?.profile?.name || profileData?.name || action.params.profileName;

  // Get role title from context or params
  const resolvedRoleTitle = action.params.roleTitle || roleData?.title || 'this role';

  console.log('KKK Action data:', action);
  console.log('KKK Profile data:', profileData);
  console.log('KKK Role data:', roleData);

  let message = '';
  const actionId = action.actionId;

  switch (actionId) {
    case 'getRoleDetails':
      message = `Can you tell me more about the ${resolvedRoleTitle} role?`;
      break;
    case 'getProfileContext':
      message = `Can you tell me more about ${resolvedProfileName || 'the candidate'}?`;
      break;
    case 'getCapabilityGaps':
      message = `What capability gaps are there between ${resolvedProfileName || 'the candidate'} and the ${resolvedRoleTitle} role?`;
      break;
    case 'getSemanticSkillRecommendations':
      message = `What skills should be developed for ${resolvedProfileName || 'the candidate'} to match the ${resolvedRoleTitle} role?`;
      break;
    case 'getDevelopmentPlan':
      message = `Can you create a development plan for ${resolvedProfileName || 'the candidate'} and the ${resolvedRoleTitle} role?`;
      break;
    case 'getReadinessAssessment':
      message = `What is ${resolvedProfileName || 'the candidate'}'s readiness for the ${resolvedRoleTitle} role?`;
      break;
    case 'explainMatch':
      message = `Can you explain how ${resolvedProfileName || 'the candidate'} matches the ${resolvedRoleTitle} role?`;
      break;
    case 'compareToRole':
      message = `Can you compare ${resolvedProfileName || 'the candidate'} to the ${resolvedRoleTitle} role?`;
      break;
    default:
      message = `Can you ${action.label?.toLowerCase() || actionId} for ${resolvedProfileName || 'the candidate'} regarding the ${resolvedRoleTitle} role?`;
  }

  return { message, actionId };
} 