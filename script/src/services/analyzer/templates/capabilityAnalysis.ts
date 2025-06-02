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
}

export const capabilityAnalysisPrompt = `You are an expert in analyzing job descriptions and identifying capabilities required for NSW Government roles.
Your task is to analyze the job description and identify the required capabilities from the NSW Public Sector Capability Framework.

The NSW Government Capability Framework consists of the following core capabilities:

Personal Attributes:
- Display Resilience and Courage: Be open and honest, prepared to express your views, and willing to accept and commit to change
- Act with Integrity: Be ethical and professional, and uphold and promote the public sector values
- Manage Self: Show drive and motivation, an ability to self-reflect and a commitment to learning
- Value Diversity and Inclusion: Demonstrate inclusive behaviour and show respect for diverse backgrounds, experiences and perspectives

Relationships:
- Communicate Effectively: Communicate clearly, actively listen to others, and respond with understanding and respect
- Commit to Customer Service: Provide customer-focused services in line with public sector and organisational objectives
- Work Collaboratively: Collaborate with others and value their contribution
- Influence and Negotiate: Gain consensus and commitment from others, and resolve issues and conflicts

Results:
- Deliver Results: Achieve results through the efficient use of resources and a commitment to quality outcomes
- Plan and Prioritise: Plan to achieve priority outcomes and respond flexibly to changing circumstances
- Think and Solve Problems: Think, analyse and consider the broader context to develop practical solutions
- Demonstrate Accountability: Be proactive and responsible for own actions, and adhere to legislation, policy and guidelines

Business Enablers:
- Finance: Understand and apply financial processes to achieve value for money and minimize financial risk
- Technology: Understand and use available technologies to maximize efficiency and effectiveness
- Procurement and Contract Management: Understand and apply procurement processes to ensure effective purchasing and contract performance
- Project Management: Understand and apply effective project planning, coordination and control methods

People Management:
- Manage and Develop People: Engage and motivate staff, and develop capability and potential in others
- Inspire Direction and Purpose: Communicate goals, priorities and vision, and recognize achievements
- Optimise Business Outcomes: Manage resources effectively and apply sound workforce planning principles
- Manage Reform and Change: Support, promote and champion change, and assist others to engage with change

Please provide your analysis in JSON format with the following structure:
{
  "capabilities": [
    {
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
  ]
}

Focus on identifying:
1. Core capabilities from the framework that are essential for the role
2. The required level for each capability based on role seniority and responsibilities
3. Relevant occupational groups and focus areas
4. Technical and soft skills required for the role
5. Clear justification for each capability's relevance

Ensure your analysis:
- Maps directly to the NSW Public Sector Capability Framework
- Reflects the role level and responsibilities accurately
- Provides specific evidence from the job description
- Identifies both technical and soft skills
- Maintains consistency with NSW Government standards`;

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