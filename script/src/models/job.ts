/**
 * @file job.ts
 * @description Part of NSW Government Jobs ETL Refactoring
 * 
 * Core job model representing a job posting from NSW Government.
 * This model maintains the same structure as the existing implementation
 * to ensure compatibility during refactoring.
 * 
 * @module models
 * @see RefactorETL.md for the complete refactoring plan
 * 
 * @author AWAI Team
 * @version 1.0.0
 * @since 2024-02-06
 * 
 * Database Tables:
 * - jobs (primary)
 * - job_documents (relation)
 * - job_capabilities (relation)
 * - job_skills (relation)
 */

export interface Job {
  id?: string;
  jobId: string;
  title: string;
  department: string;
  location: string;
  salary?: string;
  closingDate?: Date;
  sourceUrl: string;
  source?: string;
  institution?: string;
  details?: JobDetails;
  documents?: Document[];
  company_id?: string;
}

export interface JobDetails {
  description?: string;
  role?: string;
  category?: string;
  skills?: string[];
  capabilities?: Capability[];
  documents?: Document[];
  tableDetails?: {
    capabilities?: string;
    skills?: string;
  };
  additionalDetails?: string[];
}

export interface Document {
  id?: string;
  url: string;
  title?: string;
  type: string;
  parsedContent?: {
    text: string;
    structure: DocumentStructure;
    type: 'pdf' | 'docx' | 'text';
  };
  lastModified?: Date;
  source?: string;
  jobId?: string;
}

export interface PDFStructure {
  pages: Array<{
    texts: Array<{
      text: string;
      x: number;
      y: number;
      fontSize: number;
    }>;
    number: number;
    text: string;
  }>;
}

export interface DOCXStructure {
  paragraphs: Array<{
    index: number;
    text: string;
  }>;
}

export interface TextStructure {
  content: string;
}

export type DocumentStructure = PDFStructure | DOCXStructure | TextStructure;

export interface Capability {
  id?: string;
  name: string;
  description?: string;
  source_framework?: string;
  is_occupation_specific: boolean;
} 