import { AIPromptInput } from '../../../ai/types';

interface AIContext {
  currentSkills: Array<{
    name: string;
    level: number;
  }>;
  roleSkills: Array<{
    name: string;
    requiredLevel: number;
  }>;
  semanticRecommendations: Array<{
    name: string;
    relevance: number;
    description?: string;
  }>;
}

/**
 * Builds a prompt for the AI to generate skill recommendations
 * @param context Minimal context needed for AI processing
 * @returns Structured prompt for AI consumption
 */
export function buildSkillRecommendationsPrompt(context: AIContext): AIPromptInput {
  // Validate required context
  if (!context.currentSkills || !context.roleSkills || !context.semanticRecommendations) {
    throw new Error('Missing required context for skill recommendations prompt');
  }

  // Format skills for readability
  const currentSkillsList = context.currentSkills
    .map(s => `${s.name} (Level ${s.level})`)
    .join('\n');

  const roleSkillsList = context.roleSkills
    .map(s => `${s.name} (Required Level ${s.requiredLevel})`)
    .join('\n');

  const semanticRecommendationsList = context.semanticRecommendations
    .map(r => `${r.name} (Relevance: ${(r.relevance * 100).toFixed(1)}%)${r.description ? ` - ${r.description}` : ''}`)
    .join('\n');

  const system = `You are a career development expert specializing in technical skill recommendations.
Your task is to analyze a professional's current skills against role requirements and semantic matches
to provide actionable skill development recommendations.

Focus on practical, high-impact recommendations that will help the person progress toward their target role.
Consider both direct skill gaps and semantically related skills that could provide value.

For each recommendation, provide:
1. Clear priority level (high/medium/low)
2. Current and target skill levels
3. Specific learning path with resources
4. Brief explanation of why this skill is important

Format the response as a JSON object matching the SkillRecommendations interface.`;

  const user = `Please analyze the following context and provide skill recommendations:

CURRENT SKILLS:
${currentSkillsList}

ROLE REQUIREMENTS:
${roleSkillsList}

SEMANTIC RECOMMENDATIONS:
${semanticRecommendationsList}

Please provide:
1. Prioritized list of skill recommendations
2. Learning path for each skill
3. Overall explanation of recommendations

Format as JSON with:
{
  "recommendations": [{
    "name": string,
    "priority": "high" | "medium" | "low",
    "relevance": number,
    "currentLevel": number | undefined,
    "targetLevel": number,
    "learningPath": [{
      "resource": string,
      "type": string,
      "duration": string,
      "provider": string
    }],
    "explanation": string
  }],
  "explanation": string
}`;

  return {
    system,
    user
  };
} 