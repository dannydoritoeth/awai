import { AIContext } from './action.ts';
import { ChatPrompt } from '../../../ai/invokeAIModelV2.ts';

export function buildPrompt(context: AIContext): ChatPrompt {
  const { profileName, roleName, capabilityGaps = [], skillGaps = [], skillRecommendations = [], mode, audience } = context;

  // Base prompt structure
  const basePrompt = `
You are analyzing the match between ${profileName || 'the profile'} and the ${roleName || 'the role'} role.

Key Data Points:
${(capabilityGaps?.length ?? 0) > 0 ? `
Key Capability Gaps:
${capabilityGaps.map(gap => `- ${gap.name}: Current Level ${gap.currentLevel} vs Required ${gap.requiredLevel} (Gap: ${gap.gap})`).join('\n')}
` : 'No significant capability gaps identified.'}

${(skillGaps?.length ?? 0) > 0 ? `
Key Skill Gaps:
${skillGaps.map(gap => `- ${gap.name}: Current Level ${gap.currentLevel} vs Required ${gap.requiredLevel} (Gap: ${gap.gap})`).join('\n')}
` : 'No significant skill gaps identified.'}

${(skillRecommendations?.length ?? 0) > 0 ? `
Top Skill Recommendations:
${skillRecommendations.map(rec => `- ${rec.name}: Target Level ${rec.requiredLevel}`).join('\n')}
` : ''}`;

  // Mode-specific instructions
  const modeInstructions = {
    fit: 'Provide a concise assessment of the overall fit, highlighting key strengths and any critical gaps.',
    diagnostic: 'Analyze the specific gaps and mismatches in detail, explaining their impact on role readiness.',
    feedback: 'Offer constructive feedback and specific suggestions for development to improve role fit.'
  }[mode || 'fit'];

  // Audience-specific tone guidance
  const audienceTone = {
    manager: 'Use a professional tone focused on business impact and team fit.',
    candidate: 'Use an encouraging and constructive tone, focusing on growth opportunities.',
    analyst: 'Use a detailed, analytical tone with specific metrics and comparisons.'
  }[audience || 'manager'];

  return {
    system: "You are an expert at analyzing profile-role matches and providing clear, actionable insights. Format your response in two sections: first a detailed analysis, then 3-5 key highlights as bullet points starting with •",
    user: `${basePrompt}

Task: ${modeInstructions}
Audience: ${audienceTone}
Format: markdown

Please structure your response with:
1. Detailed Analysis
   - Summarize the overall match quality based on capability and skill gaps
   - Highlight key strengths and alignment areas
   - Address significant gaps or development needs
   - Provide actionable insights based on the data
   - Incorporate skill recommendations where relevant

2. Key Highlights (3-5 bullet points starting with •)
   - Extract the most important points from your analysis
   - Focus on actionable insights and critical findings
   - Include both strengths and areas for development`
  };
} 