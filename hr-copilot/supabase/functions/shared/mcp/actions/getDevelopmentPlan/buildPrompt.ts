import { AIPromptInput } from '../../../ai/types.ts';

interface AIContext {
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
}

/**
 * Builds a prompt for the AI to generate a development plan
 * @param context Minimal context needed for AI processing
 * @returns Structured prompt for AI consumption
 */
export function buildDevelopmentPlanPrompt(context: AIContext): AIPromptInput {
  // Validate required context
  if (!context.profile || !context.targetRole || !context.gaps) {
    throw new Error('Missing required context for development plan prompt');
  }

  // Format skills and capabilities for readability
  const skillsList = context.profile.skills
    .map(s => `${s.name} (Level ${s.currentLevel}, ${s.years} years)`)
    .join('\n');

  const capabilitiesList = context.profile.capabilities
    .map(c => `${c.name} (Level ${c.currentLevel})`)
    .join('\n');

  const gapsList = [
    ...context.gaps.capabilities.map(g => `${g.name} (${g.gapType}, severity: ${g.severity})`),
    ...context.gaps.skills.map(g => `${g.name} (gap: ${g.gap}, priority: ${g.priority})`)
  ].join('\n');

  const mentorsList = context.potentialMentors
    .map(m => `${m.name} (${m.title || 'Unknown'}) - Expertise: ${m.expertise?.join(', ') || 'Unknown'}`)
    .join('\n');

  const system = `You are a career development expert tasked with creating a detailed development plan. 
The plan should help a professional progress from their current profile to a target role.
Focus on practical, actionable recommendations with clear timelines and milestones.`;

  const user = `Please create a development plan with the following context:

TARGET ROLE: ${context.targetRole.title}
REQUIREMENTS: ${context.targetRole.requirements.join(', ')}

CURRENT PROFILE:
Skills:
${skillsList}

Capabilities:
${capabilitiesList}

IDENTIFIED GAPS:
${gapsList}

POTENTIAL MENTORS:
${mentorsList}

Please provide a structured development plan including:
1. Recommended skills to develop (prioritized)
2. Suggested interim roles or experiences
3. Mentor recommendations
4. Timeline (short/medium/long term goals)
5. Estimated time to role readiness

Format the response as a JSON object matching the DevelopmentPlan interface.`;

  return {
    system,
    user
  };
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