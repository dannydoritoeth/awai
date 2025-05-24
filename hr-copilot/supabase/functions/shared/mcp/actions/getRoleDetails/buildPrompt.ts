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

RESPONSE FORMAT:
Please structure your response in markdown format with the following sections:

# Role Overview
A concise summary of the role and its place in the organization

# Key Responsibilities
- List major responsibilities
- Impact areas
- Scope of influence

# Required Capabilities
- Analysis of required capabilities
- Key skills and experience needed
- Critical success factors

# Organizational Context
- Reporting relationships
- Team structure
- Budget responsibilities
- Division/department context

# Growth & Development
- Career progression opportunities
- Development areas
- Potential career paths

Use professional language and ensure all information is clearly structured using appropriate markdown formatting (headers, lists, etc).`;

  const roleCapabilities = roleDetail.capabilities
    .map(cap => `- ${cap.name} (${cap.level || 'Required'})${cap.capabilityType ? ` [${cap.capabilityType}]` : ''}`)
    .join('\n');

  const userPrompt = `Please analyze the following role:

Role Title: ${roleDetail.title}
${roleDetail.divisionName ? `Division: ${roleDetail.divisionName}` : ''}
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

Please provide a comprehensive analysis following the markdown structure specified in the system prompt.`;

  return {
    system: systemPrompt,
    user: userPrompt
  };
} 