import { AIPromptInput, SafePromptConfig } from '../../../ai/types.ts';
import { buildSafePrompt } from '../../../ai/buildSafePrompt.ts';

export interface AIContext {
  currentRole: {
    title: string;
    division: {
      name: string;
    };
    skills: Array<{
      name: string;
      level: number;
    }>;
    capabilities: Array<{
      name: string;
      type: string;
      level: number;
    }>;
  };
  personProfile?: {
    skills: Array<{
      name: string;
      level: number;
      years: number;
    }>;
    qualifications: Array<{
      name: string;
      type: string;
    }>;
    interests: Array<{
      name: string;
    }>;
    career_goals: Array<{
      goal: string;
      priority: number;
    }>;
  };
  existingTransitions: Array<{
    to_role: {
      title: string;
      division: {
        name: string;
      };
      skills: Array<{
        name: string;
        level: number;
      }>;
      capabilities: Array<{
        name: string;
        type: string;
        level: number;
      }>;
    };
    frequency: number;
    success_rate: number;
  }>;
  considerFactors: {
    skills?: boolean;
    experience?: boolean;
    qualifications?: boolean;
    interests?: boolean;
    careerGoals?: boolean;
  };
}

export function buildTransitionSuggestionsPrompt(context: AIContext): AIPromptInput {
  const promptConfig: SafePromptConfig = {
    maxLength: 4000,
    maxItems: 20,
    maxFieldLength: 300,
    priorityFields: ['title', 'name', 'level', 'type'],
    excludeFields: ['metadata', 'raw_data', 'embedding']
  };

  const systemPrompt = `You are an expert career advisor specializing in role transitions within the NSW Government.
Your task is to suggest possible role transitions based on the current role, person's profile (if available), and historical transition data.

Consider:
1. Skills and capabilities alignment
2. Career progression patterns
3. Historical success rates
4. Personal interests and goals (if available)
5. Required development areas

CRITICAL INSTRUCTIONS FOR RESPONSE FORMAT:
1. Respond with a well-structured markdown document
2. Use appropriate markdown headings (# for main sections)
3. Use bullet points and nested lists where appropriate
4. Include all the following sections:

Required Sections:
# Transition Recommendations
For each suggested transition:
- Role title and division
- Transition type (Promotion/Lateral/Career Change)
- Match score (0-100)
- Key reasons for recommendation
- Required development areas

# Development Requirements
For each transition type:
- Critical skills to develop
- Required capabilities to strengthen
- Estimated preparation time
- Suggested learning path

# Risk Assessment
For each transition type:
- Success factors
- Potential challenges
- Mitigation strategies
- Historical success rate analysis

# Implementation Strategy
- Short-term preparation steps
- Medium-term development goals
- Long-term career impact
- Support resources needed`;

  const userPrompt = `Analyze possible role transitions from the current role: ${context.currentRole.title} in ${context.currentRole.division.name}

CURRENT ROLE PROFILE:
Skills:
${context.currentRole.skills.map(s => `- ${s.name} (Level ${s.level})`).join('\n')}

Capabilities:
${context.currentRole.capabilities.map(c => `- ${c.name} (${c.type}, Level ${c.level})`).join('\n')}

${context.personProfile ? `
PERSON PROFILE:
${context.considerFactors.skills ? `Skills:
${context.personProfile.skills.map(s => `- ${s.name} (Level ${s.level}, ${s.years} years)`).join('\n')}` : ''}

${context.considerFactors.qualifications ? `Qualifications:
${context.personProfile.qualifications.map(q => `- ${q.name} (${q.type})`).join('\n')}` : ''}

${context.considerFactors.interests ? `Interests:
${context.personProfile.interests.map(i => `- ${i.name}`).join('\n')}` : ''}

${context.considerFactors.careerGoals ? `Career Goals:
${context.personProfile.career_goals.map(g => `- ${g.goal} (Priority: ${g.priority})`).join('\n')}` : ''}
` : ''}

HISTORICAL TRANSITIONS:
${context.existingTransitions.map(t => `
To: ${t.to_role.title} (${t.to_role.division.name})
- Frequency: ${t.frequency} transitions
- Success Rate: ${Math.round(t.success_rate * 100)}%
- Required Skills: ${t.to_role.skills.map(s => `${s.name} (Level ${s.level})`).join(', ')}
- Required Capabilities: ${t.to_role.capabilities.map(c => `${c.name} (${c.type}, Level ${c.level})`).join(', ')}
`).join('\n')}

Please analyze the data and generate transition recommendations following the markdown structure specified in the system prompt.`;

  return buildSafePrompt({
    system: systemPrompt,
    user: userPrompt
  }, promptConfig);
}

// Add error handling wrapper
export function buildSafeTransitionSuggestionsPrompt(context: AIContext): AIPromptInput {
  try {
    return buildTransitionSuggestionsPrompt(context);
  } catch (error) {
    console.error('Error building transition suggestions prompt:', error);
    throw new Error(`Failed to build transition suggestions prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 