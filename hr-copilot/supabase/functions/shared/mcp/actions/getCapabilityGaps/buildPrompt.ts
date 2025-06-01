import { CapabilityGap } from '../../../types.ts';
import { buildSafePrompt } from '../../promptBuilder.ts';

interface PromptData {
  gaps: CapabilityGap[];
  profileName: string;
  roleName: string;
}

/**
 * Builds a prompt for analyzing capability gaps between a profile and role
 */
export function buildCapabilityGapPrompt(data: PromptData) {
  const promptData = {
    systemPrompt: `You are an expert career advisor analyzing capability gaps between a person and a role. 
    Provide actionable insights and recommendations based on the gap analysis.
    Focus on both strengths and areas for development.
    Be encouraging but realistic about development needs.
    
    Structure your response in sections:
    1. Overall Assessment
    2. Key Strengths
    3. Critical Gaps
    4. Development Recommendations
    5. Timeline Estimate`,
    userMessage: `Please analyze the capability gaps between ${data.profileName} and the ${data.roleName} role.`,
    data: {
      gaps: data.gaps.map(gap => ({
        capability: gap.name,
        group: gap.groupName,
        type: gap.gapType,
        severity: gap.severity,
        currentLevel: gap.profileLevel,
        requiredLevel: gap.requiredLevel
      }))
    }
  };

  return buildSafePrompt('openai:gpt-3.5-turbo', promptData, {
    maxItems: 10,
    maxFieldLength: 200
  });
} 