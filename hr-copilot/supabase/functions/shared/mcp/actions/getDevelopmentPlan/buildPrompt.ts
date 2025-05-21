import { AIPromptInput, SafePromptConfig } from '../../../ai/types.ts';
import { buildSafePrompt } from '../../../ai/buildSafePrompt.ts';

export interface AIContext {
  profile: {
    skills: Array<{
      name: string;
      currentLevel: number;
      years: number;
    }>;
    capabilities: Array<{
      name: string;
      currentLevel: number;
    }>;
  };
  targetRole: {
    title: string;
    requirements: string[];
  };
  gaps: {
    capabilities: any[];
    skills: any[];
  };
  potentialMentors: Array<{
    id: string;
    name: string;
    title?: string;
    expertise?: string[];
    similarity: number;
  }>;
  previousAnalysis?: {
    capabilityReadiness?: number;
    criticalCapabilityGaps?: string[];
    recommendedSkills?: string[];
    skillPriorities?: {
      high: number;
      medium: number;
      low: number;
    };
  };
}

/**
 * Builds a prompt for the AI to generate a development plan
 * Uses buildSafePrompt to ensure prompt safety and token limits
 * 
 * @param context Minimal context needed for AI processing
 * @returns Structured prompt for AI consumption
 */
export function buildDevelopmentPlanPrompt(context: AIContext): AIPromptInput {
  const promptConfig: SafePromptConfig = {
    maxLength: 4000,
    maxItems: 20,
    maxFieldLength: 300,
    priorityFields: ['name', 'title', 'currentLevel', 'targetLevel', 'priority'],
    excludeFields: ['metadata', 'raw_data', 'embedding']
  };

  const systemPrompt = `You are an expert career development advisor tasked with creating detailed development plans.
Your goal is to create a comprehensive plan that will help someone transition into their target role.

Consider:
1. Current capabilities and skills vs. requirements
2. Critical gaps that need addressing
3. Learning paths and resources
4. Realistic timeline estimates
5. Potential interim roles
6. Mentorship opportunities

CRITICAL INSTRUCTIONS FOR RESPONSE FORMAT:
1. Respond ONLY with a valid JSON object
2. DO NOT include any markdown formatting (no \`\`\`json or \`\`\`)
3. DO NOT include any explanatory text before or after the JSON
4. Ensure all JSON properties exactly match the specified interface
5. Use proper JSON syntax (double quotes for strings, no trailing commas)

Your response must follow this exact structure:
{
  "recommendedSkills": [{
    "name": string,
    "priority": "high" | "medium" | "low",
    "currentLevel": number | null,
    "targetLevel": number,
    "timeEstimate": string,
    "trainingModules": [{
      "name": string,
      "type": string,
      "duration": string,
      "provider": string
    }]
  }],
  "interimRoles": [{
    "title": string,
    "relevance": string,
    "keySkillsGained": string[],
    "typicalDuration": string
  }],
  "suggestedMentors": [{
    "id": string,
    "name": string,
    "title": string,
    "expertise": string[],
    "matchScore": number
  }],
  "timeline": {
    "shortTerm": string[],
    "mediumTerm": string[],
    "longTerm": string[]
  },
  "estimatedTimeToReadiness": string,
  "explanation": string
}`;

  const userPrompt = `Create a development plan for transitioning into the role of ${context.targetRole.title}.

CURRENT PROFILE:
Skills:
${context.profile.skills.map(s => `- ${s.name} (Level ${s.currentLevel}, ${s.years} years)`).join('\n')}

Capabilities:
${context.profile.capabilities.map(c => `- ${c.name} (Level ${c.currentLevel})`).join('\n')}

TARGET ROLE REQUIREMENTS:
${context.targetRole.requirements.map(r => `- ${r}`).join('\n')}

IDENTIFIED GAPS:
Capability Gaps:
${context.gaps.capabilities.map(g => `- ${g.name} (Current: ${g.currentLevel}, Required: ${g.requiredLevel})`).join('\n')}

Skill Gaps:
${context.gaps.skills.map(g => `- ${g.name} (Current: ${g.currentLevel}, Required: ${g.requiredLevel})`).join('\n')}

POTENTIAL MENTORS:
${context.potentialMentors.map(m => `- ${m.name}${m.title ? ` (${m.title})` : ''} - Match: ${(m.similarity * 100).toFixed(1)}%`).join('\n')}

PREVIOUS ANALYSIS:
${context.previousAnalysis ? `
- Overall Capability Readiness: ${context.previousAnalysis.capabilityReadiness}%
- Critical Capability Gaps: ${context.previousAnalysis.criticalCapabilityGaps?.join(', ')}
- Recommended Skills: ${context.previousAnalysis.recommendedSkills?.join(', ')}
- Skill Priority Distribution:
  High: ${context.previousAnalysis.skillPriorities?.high || 0}
  Medium: ${context.previousAnalysis.skillPriorities?.medium || 0}
  Low: ${context.previousAnalysis.skillPriorities?.low || 0}
` : 'No previous analysis available'}

Please generate a comprehensive development plan following the exact JSON structure specified in the system prompt.`;

  return buildSafePrompt({
    system: systemPrompt,
    user: userPrompt
  }, promptConfig);
}

// Add error handling wrapper
export function buildSafeDevelopmentPlanPrompt(context: AIContext): AIPromptInput {
  try {
    return buildDevelopmentPlanPrompt(context);
  } catch (error) {
    console.error('Error building development plan prompt:', error);
    throw new Error(`Failed to build development plan prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 