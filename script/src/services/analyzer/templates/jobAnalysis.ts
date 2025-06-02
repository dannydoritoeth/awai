/**
 * @file jobAnalysis.ts
 * @description Part of NSW Government Jobs ETL Refactoring
 * 
 * Templates for AI analysis of job descriptions.
 * These templates maintain the same prompts as the current implementation
 * to ensure consistent AI responses during refactoring.
 * 
 * @module services/analyzer/templates
 * @see RefactorETL.md for the complete refactoring plan
 * 
 * @author AWAI Team
 * @version 1.0.0
 * @since 2024-02-06
 */

export const jobAnalysisPrompt = `
Analyze this job description and extract key information.
Consider:
1. Primary job responsibilities
2. Required experience level
3. Technical requirements
4. Soft skills needed
5. Team structure and reporting lines

Format the response as:
{
  "responsibilities": string[],
  "experienceLevel": "junior" | "mid" | "senior" | "executive",
  "technicalRequirements": string[],
  "softSkills": string[],
  "teamStructure": {
    "reportsTo": string,
    "manages": string[]
  }
}
`;

export const jobSummaryPrompt = `
Create a concise summary of this job posting.
Include:
1. Key role objectives
2. Essential requirements
3. Unique aspects of the role
4. Department context

Maximum length: 250 words
`;

export interface JobAnalysisResult {
  responsibilities: string[];
  experienceLevel: 'junior' | 'mid' | 'senior' | 'executive';
  technicalRequirements: string[];
  softSkills: string[];
  teamStructure: {
    reportsTo: string;
    manages: string[];
  };
}

export interface JobSummaryResult {
  summary: string;
  keyObjectives: string[];
  essentialRequirements: string[];
  uniqueAspects: string[];
  departmentContext: string;
} 