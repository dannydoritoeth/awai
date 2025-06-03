/**
 * @file types.ts
 * @description Part of NSW Government Jobs ETL Refactoring
 * 
 * Types and interfaces for the storage service.
 * These types maintain consistency with the current implementation
 * while providing better type safety and documentation.
 * 
 * @module services/storage
 * @see RefactorETL.md for the complete refactoring plan
 * 
 * @author AWAI Team
 * @version 1.0.0
 * @since 2024-02-06
 */

import { ProcessedJob } from '../processor/types.js';

export interface StorageConfig {
  stagingSupabaseUrl: string;
  stagingSupabaseKey: string;
  liveSupabaseUrl: string;
  liveSupabaseKey: string;
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
  jobsTable: string;
  companiesTable: string;
  rolesTable: string;
  skillsTable: string;
  capabilitiesTable: string;
  embeddingsTable: string;
  taxonomyTable: string;
  institutionId: string;
  aiService?: {
    analyzeText: (text: string) => Promise<{
      capabilities: Array<{
        name: string;
        level: string;
        description: string;
        behavioral_indicators: string[];
      }>;
      skills: Array<{
        name: string;
        description: string;
        category: string;
      }>;
    }>;
  };
}

export interface StorageMetrics {
  totalStored: number;
  successfulStores: number;
  failedStores: number;
  startTime: Date;
  endTime?: Date;
  errors: StorageError[];
}

export interface StorageError {
  operation: 'insert' | 'update' | 'delete' | 'query' | 'migration';
  table: string;
  error: string;
  timestamp: Date;
  jobId?: string;
  context?: {
    stack?: string;
    cause?: unknown;
  };
}

export interface JobRecord {
  institution_id: string;
  source_id: string;
  external_id: string;
  title: string;
  description: string;
  location: string;
  salary: string;
  agency: string;
  url: string;
  closingDate: string;
  postedDate: string;
  processedAt: string;
  version: string;
  status: string;
  raw_data: any;
  processed: boolean;
  processing_status: string;
  lastUpdated: string;
}

export interface CapabilityRecord {
  institution_id: string;
  source_id: string;
  external_id: string;
  name: string;
  level: string;
  description: string;
  relevance: number;
  occupationalGroup: string;
  focusArea: string;
  source_framework: string;
  is_occupation_specific: boolean;
  raw_data: any;
  processed: boolean;
  processing_status: string;
  processedAt: string;
}

export interface EmbeddingRecord {
  institution_id: string;
  source_id: string;
  external_id: string;
  jobId: string;
  type: 'job' | 'capability' | 'skill';
  vector: number[];
  text: string;
  metadata: any;
  raw_data: any;
  processed: boolean;
  processing_status: string;
  index?: number;
  processedAt: string;
}

export interface TaxonomyRecord {
  institution_id: string;
  source_id: string;
  external_id: string;
  jobId: string;
  name: string;
  jobFamily: string;
  jobFunction: string;
  keywords: string[];
  technicalSkills: string[];
  softSkills: string[];
  raw_data: any;
  processed: boolean;
  processing_status: string;
  processedAt: string;
}

export interface TaxonomyAnalysisResult {
  jobFamily: string;
  jobFunction: string;
  keywords: string[];
  occupationalGroups: string[];
  focusAreas: string[];
  capabilities: Array<{
    name: string;
    level: string;
    description: string;
    behavioral_indicators: string[];
    relevance?: number;
  }>;
  skills: Array<{
    name: string;
    description: string;
    category: string;
    relevance?: number;
  }>;
  raw_data: any;
  vector?: number[];
  text?: string;
  metadata?: any;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface IStorageService {
  storeJob(job: ProcessedJob): Promise<void>;
  storeBatch(jobs: ProcessedJob[]): Promise<void>;
  getJobById(id: string): Promise<JobRecord | null>;
  getJobsByFilter(filters: Record<string, any>, options?: QueryOptions): Promise<JobRecord[]>;
  getCapabilitiesByJobId(jobId: string): Promise<CapabilityRecord[]>;
  getEmbeddingsByJobId(jobId: string): Promise<EmbeddingRecord[]>;
  getTaxonomyByJobId(jobId: string): Promise<TaxonomyRecord | null>;
  getMetrics(): StorageMetrics;
  getTaxonomyGroups(): Promise<Array<{
    id: string;
    name: string;
    description: string;
  }>>;
  getRoleByJobDetails(job: JobDetails): Promise<{ id: string; title: string } | null>;
}

export interface JobDetails {
  id: string;
  title: string;
  agency: string;
  jobType: string;
  location: string | string[];
  description: string;
  responsibilities: string[];
  requirements: string[];
  notes: string[];
  aboutUs: string;
  salary: string;
  closingDate: string;
  postedDate: string;
  url: string;
  jobReference: string;
  documents?: string[];
} 