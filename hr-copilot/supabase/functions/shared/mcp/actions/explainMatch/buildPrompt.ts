import { AIContext } from './action';

export function buildPrompt(context: AIContext): string {
  const { profileName, roleName, capabilityGaps, skillGaps, fitScore, mode, audience } = context;

  // Base prompt structure
  const basePrompt = `
You are analyzing the match between ${profileName} and the ${roleName} role.

Key Data Points:
- Overall Fit Score: ${(fitScore.overall * 100).toFixed(1)}%
- Capability Match: ${(fitScore.breakdown.capabilities * 100).toFixed(1)}%
- Skills Match: ${(fitScore.breakdown.skills * 100).toFixed(1)}%
- Experience Match: ${(fitScore.breakdown.experience * 100).toFixed(1)}%

${capabilityGaps.length > 0 ? `
Key Capability Gaps:
${capabilityGaps.map(gap => `- ${gap.name}: Current Level ${gap.currentLevel} vs Required ${gap.requiredLevel} (Gap: ${gap.gap})`).join('\n')}
` : 'No significant capability gaps identified.'}

${skillGaps.length > 0 ? `
Key Skill Gaps:
${skillGaps.map(gap => `- ${gap.name}: Current Level ${gap.currentLevel} vs Required ${gap.requiredLevel} (Gap: ${gap.gap})`).join('\n')}
` : 'No significant skill gaps identified.'}
`;

  // Mode-specific instructions
  const modeInstructions = {
    fit: 'Provide a concise assessment of the overall fit, highlighting key strengths and any critical gaps.',
    diagnostic: 'Analyze the specific gaps and mismatches in detail, explaining their impact on role readiness.',
    feedback: 'Offer constructive feedback and specific suggestions for development to improve role fit.'
  }[mode];

  // Audience-specific tone guidance
  const audienceTone = {
    manager: 'Use a professional tone focused on business impact and team fit.',
    candidate: 'Use an encouraging and constructive tone, focusing on growth opportunities.',
    analyst: 'Use a detailed, analytical tone with specific metrics and comparisons.'
  }[audience];

  // Final prompt assembly
  return `${basePrompt}

Task: ${modeInstructions}
Audience: ${audienceTone}

Please provide a structured analysis that:
1. Summarizes the overall match quality
2. Highlights key strengths and alignment areas
3. Addresses significant gaps or development needs
4. Provides actionable insights based on the data

Format the response in clear, professional language appropriate for the specified audience.`;
} 