import { buildSafePrompt } from '../../promptBuilder.ts';
import { SemanticMatch } from '../../../mcpTypes.ts';

interface PromptData {
  profile: {
    skills: Array<{
      name: string;
      level: number;
      years: number;
    }>;
    capabilities: Array<{
      name: string;
      level: number;
    }>;
  };
  matches: SemanticMatch[];
  recommendations: Array<{
    type: string;
    score: number;
    semanticScore: number;
    summary: string;
    details: {
      jobId?: string;
      roleId: string;
      title: string;
    };
  }>;
  message?: string;
}

/**
 * Builds a prompt for analyzing role matches and providing career recommendations
 */
export function buildMatchingRolesPrompt(data: PromptData) {
  const promptData = {
    systemPrompt: `You are an AI career advisor providing detailed, personalized job recommendations and career advice. 
    Focus on actionable insights and practical steps.
    
    Structure your response in sections:
    1. PROFILE OVERVIEW
       - Key strengths and qualifications
       - Areas for potential growth
    
    2. OPPORTUNITY ANALYSIS
       - Best matching roles and why
       - Required transitions or upskilling
    
    3. SKILL GAP ASSESSMENT
       - Critical skills to develop
       - Estimated timeline for acquisition
    
    4. CAREER PATH RECOMMENDATIONS
       - Suggested next steps
       - Long-term career trajectory
    
    5. NEXT STEPS
       - Immediate actions to take
       - Resources to leverage
    
    End with a follow-up question to help guide the candidate's next steps.`,
    userMessage: data.message || 'Please analyze the opportunities and provide career recommendations.',
    data: {
      profile: data.profile,
      matches: data.matches.slice(0, 5),
      recommendations: data.recommendations.slice(0, 5)
    },
    context: {
      sections: [
        'PROFILE OVERVIEW',
        'OPPORTUNITY ANALYSIS',
        'SKILL GAP ASSESSMENT',
        'CAREER PATH RECOMMENDATIONS',
        'NEXT STEPS'
      ]
    }
  };

  return buildSafePrompt('openai:gpt-3.5-turbo', promptData, {
    maxItems: 5,
    maxFieldLength: 200,
    priorityFields: ['name', 'title', 'summary', 'score', 'semanticScore'],
    excludeFields: ['metadata', 'raw_data', 'embedding']
  });
} 