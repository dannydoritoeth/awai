import { AIPromptInput } from '../../../ai/types.ts';
import { RoleDetail } from "../../../role/getRoleDetail.ts";

interface RoleDetailsContext {
  roleId: string;
  roleTitle?: string;
  roleDetail: RoleDetail;
}

/**
 * Builds a structured prompt for analyzing role details
 * Focuses on creating a natural language description of the role's
 * responsibilities, requirements, and organizational context
 */
export function buildPromptInput(context: Record<string, any>): AIPromptInput {
  const { roleDetail } = context as RoleDetailsContext;

  const systemPrompt = `You are an expert career advisor and organizational development specialist.
Your task is to analyze the provided role details and create a comprehensive, well-structured description
of the role, its responsibilities, and its place in the organization.

Focus on:
1. Key responsibilities and scope
2. Required capabilities and their importance
3. Organizational context and impact
4. Career development opportunities

Use a professional, clear tone and structure the information logically. Don't include guids or ids in the response.`;

  const roleCapabilities = roleDetail.capabilities
    .map(cap => `- ${cap.name} (${cap.level || 'Required'})${cap.capabilityType ? ` [${cap.capabilityType}]` : ''}`)
    .join('\n');

  const userPrompt = `Please analyze the following role:

Role Title: ${roleDetail.title}
${roleDetail.divisionId ? `Division: ${roleDetail.divisionId}` : ''}
${roleDetail.gradeBand ? `Grade Band: ${roleDetail.gradeBand}` : ''}
${roleDetail.location ? `Location: ${roleDetail.location}` : ''}

Primary Purpose:
${roleDetail.primaryPurpose || 'Not specified'}

Reporting Structure:
${roleDetail.reportingLine ? `Reports to: ${roleDetail.reportingLine}` : 'Reporting line not specified'}
${roleDetail.directReports ? `Direct Reports: ${roleDetail.directReports}` : 'No direct reports specified'}

Budget Responsibility:
${roleDetail.budgetResponsibility || 'Not specified'}

Required Capabilities:
${roleCapabilities}

Please provide:
1. A comprehensive overview of this role
2. Key responsibilities and impact areas
3. Required skills and experience analysis
4. Career development opportunities and growth potential
5. Any notable insights about the role's organizational context`;

  return {
    system: systemPrompt,
    user: userPrompt
  };
} 