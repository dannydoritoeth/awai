/**
 * @file types.ts
 * @description Part of NSW Government Jobs ETL Refactoring
 * 
 * Types and interfaces for the processor service.
 * These types maintain consistency with the current implementation
 * while providing better type safety and documentation.
 * 
 * @module services/processor
 * @see RefactorETL.md for the complete refactoring plan
 * 
 * @author AWAI Team
 * @version 1.0.0
 * @since 2024-02-06
 */

import { JobDetails } from '../spider/types.js';
import { CapabilityAnalysisResult, TaxonomyAnalysisResult } from '../analyzer/templates/capabilityAnalysis.js';
import { EmbeddingResult } from '../embeddings/templates/embeddingTemplates.js';

export interface ProcessorConfig {
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
  version: string;
}

export interface ProcessedJob {
  jobDetails: JobDetails;
  capabilities: CapabilityAnalysisResult;
  taxonomy: {
    taxonomyIds: string[];
    roleId: string;
    technicalSkills?: string[];
    softSkills?: string[];
  };
  embeddings: {
    job: EmbeddingResult;
    capabilities: Array<EmbeddingResult | undefined>;
    skills: EmbeddingResult[];
  };
  metadata: {
    processedAt: string;
    version: string;
    status: ProcessingStatus;
  };
}

export interface ProcessingMetrics {
  totalProcessed: number;
  successfulProcesses: number;
  failedProcesses: number;
  averageProcessingTime: number;
  errors: ProcessingError[];
}

export interface ProcessingError {
  stage: 'analysis' | 'embedding';
  error: string;
  timestamp: string;
  context?: {
    jobId: string;
    stack?: string;
    cause?: unknown;
  };
}

export type ProcessingStatus = 'processing' | 'completed' | 'failed';

export interface IProcessorService {
  processJob(job: JobDetails): Promise<ProcessedJob | undefined>;
  processBatch(jobs: JobDetails[]): Promise<(ProcessedJob | undefined)[]>;
  getMetrics(): ProcessingMetrics;
} 