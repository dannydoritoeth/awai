import { AIPromptInput } from '../../../ai/types.ts';

interface ProfileContext {
  profile: {
    name: string;
    skills: Array<{ name: string; level: number }>;
    capabilities: Array<{ name: string; level: number }>;
  };
  careerPath?: {
    current_role?: string;
    target_role?: string;
  };
  jobInteractions: Array<{
    status: string;
    job_id: string;
    applied_date: string;
  }>;
}

interface ProfileContextInput {
  profileId: string;
  profileContext: ProfileContext;
}

/**
 * Builds a structured prompt for analyzing profile context
 * Focuses on creating a natural language description of the person's
 * skills, capabilities, career path, and job interactions
 */
export function buildPromptInput(context: Record<string, any>): AIPromptInput {
  const { profileContext } = context as ProfileContextInput;

  const systemPrompt = `You are an expert career advisor and talent development specialist.
Your task is to analyze the provided profile details and create a comprehensive, well-structured assessment
of the person's skills, capabilities, and career trajectory.

Focus on:
1. Current skill set and proficiency levels
2. Core capabilities and strengths
3. Career progression and aspirations
4. Recent job interactions and engagement

RESPONSE FORMAT:
Please structure your response in markdown format with the following sections:

# Profile Overview
A concise summary of the person's current status and career direction

# Skills & Expertise
- Analysis of technical skills
- Proficiency levels
- Areas of specialization

# Core Capabilities
- Analysis of professional capabilities
- Strengths and development areas
- Leadership potential

# Career Journey
- Current role and experience
- Career aspirations
- Recent job interactions

# Development Opportunities
- Suggested focus areas
- Potential career paths
- Growth recommendations

Use professional language and ensure all information is clearly structured using appropriate markdown formatting (headers, lists, etc).`;

  const skills = profileContext.profile.skills
    .map(skill => `- ${skill.name} (Level ${skill.level})`)
    .join('\\n');

  const capabilities = profileContext.profile.capabilities
    .map(cap => `- ${cap.name} (Level ${cap.level})`)
    .join('\\n');

  const jobHistory = profileContext.jobInteractions
    .map(job => `- ${job.status}: ${job.job_id} (${new Date(job.applied_date).toLocaleDateString()})`)
    .join('\\n');

  const userPrompt = `Please analyze the following profile:

Name: ${profileContext.profile.name}
${profileContext.careerPath?.current_role ? `Current Role: ${profileContext.careerPath.current_role}` : ''}
${profileContext.careerPath?.target_role ? `Target Role: ${profileContext.careerPath.target_role}` : ''}

Skills:
${skills}

Capabilities:
${capabilities}

Recent Job Interactions:
${jobHistory}

Please provide a comprehensive analysis following the markdown structure specified in the system prompt.`;

  return {
    system: systemPrompt,
    user: userPrompt
  };
} 