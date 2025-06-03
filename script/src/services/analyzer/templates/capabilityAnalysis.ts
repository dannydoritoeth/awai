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
  }>;
  generalRole: {
    id?: string; // If matching an existing role
    title: string;
    description: string;
    confidence: number; // Match score between 0-1
    isNewRole?: boolean; // Indicates if this is a suggested new general role
  };
}

interface CapabilityGroup {
  [key: string]: string[];
}

export const createCapabilityAnalysisPrompt = (
  frameworkCapabilities: Array<{ id: string; name: string; description: string; group_name: string }>,
  taxonomyGroups: Array<{ id: string; name: string; description: string }>,
  similarGeneralRoles: Array<{ id: string; name: string; description: string; similarity: number }>
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

  // Build the similar general roles section
  let generalRolesPrompt = 'Similar General Roles Found:\n';
  if (similarGeneralRoles.length > 0) {
    similarGeneralRoles.forEach(role => {
      generalRolesPrompt += `- ${role.name} (${role.id}) [Similarity: ${(role.similarity * 100).toFixed(1)}%]: ${role.description}\n`;
    });
  } else {
    generalRolesPrompt += 'No similar general roles found. Please suggest a new general role category.\n';
  }

  return `You are an expert in analyzing job descriptions and identifying capabilities required for NSW Government roles.
Your task is to analyze the job description and:
1. Identify required capabilities from the NSW Public Sector Capability Framework
2. Classify the role into taxonomy groups
3. Determine the most appropriate general role category

${capabilitiesPrompt}

${taxonomyPrompt}

${generalRolesPrompt}

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
  ],
  "generalRole": {
    "id": "ID of the matching general role (if one exists)",
    "title": "Title of the general role (existing or suggested new)",
    "description": "Description of how this role fits the general role category",
    "confidence": "Number between 0-1 indicating match confidence",
    "isNewRole": "true if suggesting a new general role, false if matching existing"
  }
}

Focus on identifying:
1. Core capabilities from the EXACT list provided above - do not create new capabilities
2. The required level for each capability based on role seniority and responsibilities
3. Relevant occupational groups and focus areas
4. Technical and soft skills required for the role
5. Clear justification for each capability's relevance
6. Appropriate taxonomy groups that best match the role's responsibilities and requirements
7. The most appropriate general role category, either:
   - Matching to an existing general role if similarity is high (>0.7)
   - Suggesting a new general role if no good matches exist

For General Role Analysis:
- If similar roles are found with high confidence (>0.7), select the best matching one
- If no good matches exist, suggest a new general role that could apply to similar roles
- Provide a clear description of why the role fits the general category
- Consider the role's core functions, not just the title
- Look for patterns in capabilities and skills that indicate role similarity

Ensure your analysis:
- ONLY uses capabilities and taxonomies from the provided lists with their exact IDs
- Maps directly to the NSW Public Sector Capability Framework
- Reflects the role level and responsibilities accurately
- Provides specific evidence from the job description
- Identifies both technical and soft skills
- Maintains consistency with NSW Government standards
- Makes appropriate general role categorization based on core functions`;
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
export const capabilityAnalysisPrompt = createCapabilityAnalysisPrompt([], [], []); 