import { AIPromptInput } from '../../../ai/types.ts';

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

CRITICAL INSTRUCTIONS FOR RESPONSE FORMAT:
1. Respond ONLY with a valid JSON object
2. DO NOT include any markdown formatting (no \`\`\`json or \`\`\`)
3. DO NOT include any explanatory text before or after the JSON
4. Ensure all JSON properties exactly match the specified interface
5. Use proper JSON syntax (double quotes for strings, no trailing commas)

For each recommendation, provide:
1. Clear priority level (high/medium/low)
2. Current and target skill levels
3. Specific learning path with resources
4. Brief explanation of why this skill is important`;

  const user = `Please analyze the following context and provide skill recommendations:

CURRENT SKILLS:
${currentSkillsList}

ROLE REQUIREMENTS:
${roleSkillsList}

SEMANTIC RECOMMENDATIONS:
${semanticRecommendationsList}

RESPONSE REQUIREMENTS:
1. Return ONLY a JSON object with this exact structure:
{
  "recommendations": [{
    "name": string,           // Name of the skill
    "priority": string,       // Must be exactly "high", "medium", or "low"
    "relevance": number,      // Number between 0 and 1
    "currentLevel": number,   // Current skill level (1-5) or null if not present
    "targetLevel": number,    // Target skill level (1-5)
    "learningPath": [{
      "resource": string,     // Name or URL of the resource
      "type": string,        // e.g., "course", "book", "workshop"
      "duration": string,    // e.g., "2 weeks", "3 months"
      "provider": string     // Organization providing the resource
    }],
    "explanation": string    // Why this skill is important
  }],
  "explanation": string      // Overall explanation of recommendations
}

2. Ensure the response is a single, valid JSON object
3. Do not include any text or formatting outside the JSON object`;

  return {
    system,
    user
  };
} 