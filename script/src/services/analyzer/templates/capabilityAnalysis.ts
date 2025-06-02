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
  capabilities: {
    name: string;
    level: 'foundational' | 'intermediate' | 'adept' | 'advanced' | 'highly advanced';
    description: string;
    relevance: number;
  }[];
  occupationalGroups: string[];
  focusAreas: string[];
  skills: {
    name: string;
    description?: string;
    category?: string;
  }[];
}

export const capabilityAnalysisPrompt = `You are an expert in analyzing job descriptions and identifying capabilities required for NSW Government roles.
Your task is to analyze the job description and identify the required capabilities from the NSW Public Sector Capability Framework.

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
  jobFamily: string;
  jobFunction: string;
  keywords: string[];
  skills: {
    technical: string[];
    soft: string[];
  };
}

export const taxonomyAnalysisPrompt = `You are an expert in job classification and skills taxonomy.
Your task is to analyze the job description and classify it according to standard job taxonomies and extract relevant skills.

Please provide your analysis in JSON format with the following structure:
{
  "jobFamily": "High-level job category",
  "jobFunction": "Specific job function within the family",
  "keywords": ["List of relevant keywords"],
  "skills": {
    "technical": ["List of technical skills"],
    "soft": ["List of soft skills"]
  }
}

Focus on:
1. Accurate job family and function classification
2. Comprehensive skill identification
3. Relevant industry keywords
4. Both technical and soft skills

Ensure your analysis:
- Uses standardized job classifications
- Identifies both required and preferred skills
- Extracts keywords that aid in job matching
- Maintains consistency with industry standards`; 