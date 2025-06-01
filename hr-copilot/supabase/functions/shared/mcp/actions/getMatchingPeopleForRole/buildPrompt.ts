/**
 * Builds AI prompt for analyzing candidate matches
 */

import { AIPromptInput } from '../../../ai/types.ts';

interface AIContext {
  role: {
    title: string;
    description?: string;
    department?: string;
    requiredCapabilities: string[];
    requiredSkills: string[];
  };
  matches: Array<{
    name: string;
    score: number;
    semanticScore: number;
    capabilities: {
      matched: string[];
      missing: string[];
      insufficient: string[];
    };
    skills: {
      matched: string[];
      missing: string[];
      insufficient: string[];
    };
    summary?: string;
  }>;
}

export function buildPromptInput(context: AIContext): AIPromptInput {
  return {
    system: `You are an AI hiring advisor helping to analyze candidate matches for a role.
Your task is to:
1. Evaluate each candidate's fit based on capabilities, skills, and semantic matching
2. Highlight key strengths and potential gaps
3. Provide actionable recommendations for next steps

Focus on being:
- Objective in your analysis
- Clear about both strengths and areas for development
- Specific in your recommendations`,
    
    user: `Please analyze the following candidates for the ${context.role.title} role:

Role Requirements:
${context.role.description ? `Description: ${context.role.description}\n` : ''}
${context.role.department ? `Department: ${context.role.department}\n` : ''}
Required Capabilities: ${context.role.requiredCapabilities.join(', ')}
Required Skills: ${context.role.requiredSkills.join(', ')}

Top Candidates:
${context.matches.map((match, index) => `
${index + 1}. ${match.name} (${(match.score * 100).toFixed(0)}% fit, ${(match.semanticScore * 100).toFixed(0)}% semantic match)
   Matched Capabilities: ${match.capabilities.matched.join(', ')}
   Missing Capabilities: ${match.capabilities.missing.join(', ')}
   Matched Skills: ${match.skills.matched.join(', ')}
   Missing Skills: ${match.skills.missing.join(', ')}
   ${match.summary ? `Summary: ${match.summary}` : ''}
`).join('\n')}

Please provide:
1. An analysis of each candidate's fit for the role
2. Key strengths and potential gaps
3. Recommended next steps for each candidate
4. Overall hiring recommendations`
  };
} 