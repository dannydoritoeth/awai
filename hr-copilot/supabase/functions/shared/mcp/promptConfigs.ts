import { PromptData, PromptOptions } from './promptTypes.ts';

/**
 * Shared prompt configurations for MCP modules
 */
export const PROMPT_CONFIGS: Record<string, {
  promptData: Partial<PromptData>;
  options: PromptOptions;
}> = {
  careerPath: {
    promptData: {
      systemPrompt: `You are a career advisor helping to analyze career paths and opportunities.
Focus on providing actionable insights and clear next steps.
Use data to support your recommendations.
Be encouraging but realistic about skill gaps and development needs.`,
      userMessage: "Based on the profile's current skills and experience, what career paths would you recommend?"
    },
    options: {
      maxItems: 5,
      maxFieldLength: 500,
      priorityFields: ['name', 'title', 'level', 'category'],
      excludeFields: ['id', 'created_at', 'updated_at']
    }
  },

  hiring: {
    promptData: {
      systemPrompt: `You are a hiring advisor helping to evaluate candidate fit for roles.
Focus on both technical skills and potential for growth.
Consider team dynamics and organizational culture.
Be objective and data-driven in your analysis.`,
      userMessage: "Based on the role requirements and candidate profile, how well does this candidate fit?"
    },
    options: {
      maxItems: 5,
      maxFieldLength: 500,
      priorityFields: ['name', 'title', 'level', 'category'],
      excludeFields: ['id', 'created_at', 'updated_at']
    }
  },

  capability: {
    promptData: {
      systemPrompt: `You are analyzing organizational capabilities and skill distributions.
Focus on identifying patterns and gaps.
Provide actionable recommendations for capability development.`,
      userMessage: "What insights can you provide about the capability distribution?"
    },
    options: {
      maxItems: 10,
      maxFieldLength: 1000,
      priorityFields: ['name', 'level', 'count', 'percentage'],
      excludeFields: ['id', 'created_at', 'updated_at']
    }
  },

  jobReadiness: {
    promptData: {
      systemPrompt: `You are evaluating job readiness and development needs.
Focus on concrete steps for skill development.
Consider both immediate fit and growth potential.
Provide specific recommendations for closing gaps.`,
      userMessage: "How ready is this profile for the target job, and what development is needed?"
    },
    options: {
      maxItems: 5,
      maxFieldLength: 500,
      priorityFields: ['name', 'level', 'requirements', 'gaps'],
      excludeFields: ['id', 'created_at', 'updated_at']
    }
  },

  skillGap: {
    promptData: {
      systemPrompt: `You are analyzing skill gaps and development needs.
Focus on practical steps for skill acquisition.
Consider both formal training and on-the-job development.
Prioritize gaps based on impact and effort to close.`,
      userMessage: "What are the key skill gaps and how can they be addressed?"
    },
    options: {
      maxItems: 5,
      maxFieldLength: 500,
      priorityFields: ['name', 'level', 'gap', 'priority'],
      excludeFields: ['id', 'created_at', 'updated_at']
    }
  }
}; 