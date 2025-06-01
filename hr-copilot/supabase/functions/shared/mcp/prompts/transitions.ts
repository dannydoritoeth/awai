interface PromptParams {
  currentRole: any;
  personProfile: any | null;
  existingTransitions: any[];
  maxSuggestions: number;
  considerFactors?: {
    skills?: boolean;
    experience?: boolean;
    qualifications?: boolean;
    interests?: boolean;
    careerGoals?: boolean;
  };
}

export function generatePrompt(params: PromptParams): string {
  const {
    currentRole,
    personProfile,
    existingTransitions,
    maxSuggestions,
    considerFactors = {}
  } = params;

  // Build context sections
  const sections: string[] = [];

  // Current role context
  sections.push(`
Current Role:
Title: ${currentRole.title}
Division: ${currentRole.division.name}
Skills: ${currentRole.skills.map((s: any) => s.skill.name).join(', ')}
Capabilities: ${currentRole.capabilities.map((c: any) => c.capability.name).join(', ')}
  `);

  // Person context if available
  if (personProfile && (
    considerFactors.skills ||
    considerFactors.experience ||
    considerFactors.qualifications ||
    considerFactors.interests ||
    considerFactors.careerGoals
  )) {
    sections.push(`
Person Profile:
${considerFactors.skills ? `Skills: ${personProfile.skills.map((s: any) => `${s.skill.name} (${s.level})`).join(', ')}` : ''}
${considerFactors.qualifications ? `Qualifications: ${personProfile.qualifications.map((q: any) => q.qualification.name).join(', ')}` : ''}
${considerFactors.interests ? `Interests: ${personProfile.interests.map((i: any) => i.interest.name).join(', ')}` : ''}
${considerFactors.careerGoals ? `Career Goals: ${personProfile.career_goals.map((g: any) => g.goal).join(', ')}` : ''}
    `);
  }

  // Existing transitions context
  if (existingTransitions.length > 0) {
    sections.push(`
Common Transitions:
${existingTransitions.slice(0, 5).map((t: any) => `- ${t.to_role.title} (${t.to_role.division.name})`).join('\n')}
    `);
  }

  // Build the main prompt
  const prompt = `
You are a career advisor AI specializing in the NSW Government sector. Your task is to suggest possible role transitions based on the following context:

${sections.join('\n')}

Please suggest up to ${maxSuggestions} potential role transitions. For each suggestion, provide:
1. The target role ID
2. A brief explanation of why this role would be a good fit
3. Key skills that would transfer well
4. Skills that would need development
5. Estimated time to prepare for the transition

Format your response as a JSON array of objects with the following structure:
{
  "roleId": "uuid",
  "explanation": "string",
  "transferableSkills": ["skill1", "skill2"],
  "developmentNeeds": ["skill1", "skill2"],
  "preparationTimeMonths": number
}

Focus on roles that:
- Build on existing skills and capabilities
- Align with career progression patterns
- Match the person's interests and goals (if provided)
- Represent realistic and achievable transitions

Your suggestions should be specific and actionable, with clear rationale for each recommendation.
`;

  return prompt;
} 