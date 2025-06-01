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
1. Respond with a well-structured markdown document
2. Use appropriate markdown headings (# for main sections)
3. Use bullet points and nested lists where appropriate
4. Include all the following sections in your response:

Required Sections:
# Development Plan Summary
Brief overview of the plan and estimated time to readiness

# Key Skills to Develop
For each skill include:
- Name and priority level (High/Medium/Low)
- Current and target levels
- Time estimate
- Recommended training modules/resources

# Suggested Career Path
List interim roles that could help build required skills:
- Role title
- Typical duration
- Relevance to target role
- Key skills gained

# Mentorship Recommendations
For each potential mentor:
- Name and current role
- Areas of expertise
- Match score and why they'd be a good mentor

# Timeline
Break down into:
- Short-term goals (0-6 months)
- Medium-term goals (6-12 months)
- Long-term goals (12+ months)

# Implementation Strategy
Practical steps and recommendations for executing the plan`;

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

Please generate a comprehensive development plan following the markdown structure specified in the system prompt.`;

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