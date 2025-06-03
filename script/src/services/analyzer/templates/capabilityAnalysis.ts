/**
 * @file capabilityAnalysis.ts
 * @description Part of NSW Government Jobs ETL Refactoring
 * 
 * Templates and types for capability analysis.
 * These templates maintain the same analysis logic as the current implementation
 * to ensure consistent results during refactoring.
 * 
 * @module services/analyzer/templates
 * @see RefactorETL.md for the complete refactoring plan
 * 
 * @author AWAI Team
 * @version 1.0.0
 * @since 2024-02-06
 */

export interface CapabilityAnalysisResult {
  capabilities: Array<{
    id: string;
    name: string;
    level: 'foundational' | 'intermediate' | 'adept' | 'advanced' | 'highly advanced';
    description: string;
    relevance: number;
  }>;
  occupationalGroups: string[];
  focusAreas: string[];
  skills: Array<{
    name: string;
    description: string;
    category: 'Technical' | 'Domain Knowledge' | 'Soft Skills';
  }>;
  taxonomies: Array<{
    id: string;
    name: string;
    description: string;
    relevance: number;
  }>;
}

interface CapabilityGroup {
  [key: string]: string[];
}

export const createCapabilityAnalysisPrompt = (
  frameworkCapabilities: Array<{ id: string; name: string; description: string; group_name: string }>,
  taxonomyGroups: Array<{ id: string; name: string; description: string }>
) => {
  // Generate the capabilities list for the prompt
  const capabilitiesByGroup: CapabilityGroup = {};
  frameworkCapabilities.forEach(cap => {
    if (!capabilitiesByGroup[cap.group_name]) {
      capabilitiesByGroup[cap.group_name] = [];
    }
    capabilitiesByGroup[cap.group_name].push(`${cap.name} (${cap.id}): ${cap.description}`);
  });

  // Build the capabilities section of the prompt
  let capabilitiesPrompt = 'NSW Government Capability Framework core capabilities:\n\n';
  for (const [group, capabilities] of Object.entries(capabilitiesByGroup)) {
    capabilitiesPrompt += `${group}:\n${capabilities.map((c: string) => `- ${c}`).join('\n')}\n\n`;
  }

  // Build the taxonomy section of the prompt
  let taxonomyPrompt = 'Available Taxonomy Groups:\n';
  taxonomyGroups.forEach(tax => {
    taxonomyPrompt += `- ${tax.name} (${tax.id}): ${tax.description}\n`;
  });

  return `You are an expert in analyzing job descriptions and identifying capabilities required for NSW Government roles.
Your task is to analyze the job description and identify the required capabilities from the NSW Public Sector Capability Framework,
as well as classify the role into one or more taxonomy groups.

${capabilitiesPrompt}

${taxonomyPrompt}

Please provide your analysis in JSON format with the following structure:
{
  "capabilities": [
    {
      "id": "Capability ID from the provided list",
      "name": "Capability name from the framework",
      "level": "One of: foundational, intermediate, adept, advanced, highly advanced",
      "description": "Brief description of how this capability applies to the role",
      "relevance": "Number between 0-1 indicating relevance to the role"
    }
  ],
  "occupationalGroups": ["List of relevant occupational groups"],
  "focusAreas": ["List of focus areas or specializations"],
  "skills": [
    {
      "name": "Specific skill name",
      "description": "How this skill is used in the role",
      "category": "One of: Technical, Domain Knowledge, Soft Skills"
    }
  ],
  "taxonomies": [
    {
      "id": "Taxonomy ID from the provided list",
      "name": "Taxonomy name from the list"
    }
  ]
}

Focus on identifying:
1. Core capabilities from the EXACT list provided above - do not create new capabilities
2. The required level for each capability based on role seniority and responsibilities
3. Relevant occupational groups and focus areas
4. Technical and soft skills required for the role
5. Clear justification for each capability's relevance
6. Appropriate taxonomy groups that best match the role's responsibilities and requirements

Ensure your analysis:
- ONLY uses capabilities and taxonomies from the provided lists with their exact IDs
- Maps directly to the NSW Public Sector Capability Framework
- Reflects the role level and responsibilities accurately
- Provides specific evidence from the job description
- Identifies both technical and soft skills
- Maintains consistency with NSW Government standards
- Assigns taxonomies based on the role's primary functions and responsibilities`;
};

export interface TaxonomyAnalysisResult {
  technicalSkills: string[];
  softSkills: string[];
  summary: string;
}

export const taxonomyAnalysisPrompt = `You are an expert in analyzing job descriptions and identifying required skills.

Your task is to analyze the job description and extract two types of skills:
1. Technical skills: Specific technical abilities, tools, methodologies, or domain knowledge required
2. Soft skills: Interpersonal abilities, behavioral traits, and professional competencies needed

Please provide your analysis in JSON format with the following structure:
{
  "technicalSkills": ["List of specific technical skills, tools, and domain knowledge"],
  "softSkills": ["List of interpersonal and behavioral skills"],
  "summary": "A concise 1-2 sentence summary of the role's key requirements"
}

Guidelines:
- Technical skills should be specific and actionable (e.g. "Python programming" not just "programming")
- Soft skills should be clear and professionally relevant (e.g. "stakeholder management" not just "people skills")
- Keep skills concise and focused
- Avoid duplicates
- Use consistent terminology
- The summary should capture the essence of the role and its key requirements`;

// Keeping the old export name for backward compatibility
export const capabilityAnalysisPrompt = createCapabilityAnalysisPrompt([], []); 