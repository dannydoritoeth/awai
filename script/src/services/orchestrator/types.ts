/**
 * @file types.ts
 * @description Part of NSW Government Jobs ETL Refactoring
 * 
 * Types and interfaces for the orchestrator service.
 * This service coordinates the ETL pipeline components.
 * 
 * @module services/orchestrator
 * @see RefactorETL.md for the complete refactoring plan
 * 
 * @author AWAI Team
 * @version 1.0.0
 * @since 2024-02-06
 */

import { SpiderService } from '../spider/SpiderService.js';
import { ProcessorService } from '../processor/ProcessorService.js';
import { StorageService } from '../storage/StorageService.js';
import { JobDetails } from '../spider/types.js';
import { ProcessedJob } from '../processor/types.js';

export interface OrchestratorConfig {
  batchSize: number;
  maxConcurrency: number;
  retryAttempts: number;
  retryDelay: number;
  pollInterval: number;
}

// Type for logged version of ProcessedJob with hidden vectors
export type LoggedProcessedJob = Omit<ProcessedJob, 'embeddings'> & {
  embeddings: {
    job: Omit<ProcessedJob['embeddings']['job'], 'vector'> & { vector: string };
    capabilities: Array<Omit<ProcessedJob['embeddings']['capabilities'][0], 'vector'> & { vector: string }>;
    skills: Array<Omit<ProcessedJob['embeddings']['skills'][0], 'vector'> & { vector: string }>;
  };
};

export type PipelineStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'completed' | 'failed';

export type PipelineStage = 'scraping' | 'processing' | 'storage' | 'migration';

export type PipelineError = {
  stage: PipelineStage;
  error: Error | string;
  jobId?: string;
  timestamp: Date;
};

export type PipelineMetrics = {
  jobsScraped: number;
  jobsProcessed: number;
  jobsStored: number;
  failedScrapes: number;
  failedProcesses: number;
  failedStorage: number;
  startTime: Date;
  endTime?: Date;
  totalDuration?: number;
  errors: PipelineError[];
  scraping?: {
    total: number;
    successful: number;
    failed: number;
  };
  processing?: {
    total: number;
    successful: number;
    failed: number;
  };
  storage?: {
    total: number;
    successful: number;
    failed: number;
    migratedToLive: number;
  };
};

export type PipelineResult = {
  status: PipelineStatus;
  metrics: PipelineMetrics & {
    endTime: Date;
    totalDuration: number;
    scraping: {
      total: number;
      successful: number;
      failed: number;
    };
    processing: {
      total: number;
      successful: number;
      failed: number;
    };
    storage: {
      total: number;
      successful: number;
      failed: number;
      migratedToLive: number;
    };
  };
  jobs: {
    scraped: JobDetails[];
    processed: LoggedProcessedJob[];
    stored: LoggedProcessedJob[];
    failed: {
      scraping: JobDetails[];
      processing: JobDetails[];
      storage: JobDetails[];
    };
  };
};

export type PipelineOptions = {
  maxRecords?: number;
  migrateToLive?: boolean;
  skipProcessing?: boolean;
  skipStorage?: boolean;
  skipMigration?: boolean;
};

export interface IOrchestratorService {
  runPipeline(options?: PipelineOptions): Promise<PipelineResult>;
  stop(): void;
  pause(): void;
  resume(): void;
  cleanup(): Promise<void>;
}

export interface PipelineState {
  status: PipelineStatus;
  currentBatch: number;
  totalBatches: number;
  currentStage: PipelineStage;
  options?: PipelineOptions;
  metrics: PipelineMetrics;
  lastError?: PipelineError;
  lastSuccessfulRun?: Date;
} 