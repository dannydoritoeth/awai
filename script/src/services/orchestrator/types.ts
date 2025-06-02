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

export interface PipelineMetrics {
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
}

export interface PipelineError {
  stage: PipelineStage;
  error: string;
  timestamp: Date;
  jobId?: string;
  context?: {
    stack?: string;
    cause?: unknown;
  };
}

export interface PipelineResult {
  status: PipelineStatus;
  metrics: PipelineMetrics;
  jobs: {
    scraped: JobDetails[];
    processed: ProcessedJob[];
    stored: ProcessedJob[];
    failed: {
      scraping: JobDetails[];
      processing: JobDetails[];
      storage: ProcessedJob[];
    };
  };
}

export interface PipelineOptions {
  startDate?: Date;
  endDate?: Date;
  agencies?: string[];
  locations?: string[];
  skipProcessing?: boolean;
  skipStorage?: boolean;
  continueOnError?: boolean;
  maxRecords?: number;
  migrateToLive?: boolean;
}

export interface IOrchestratorService {
  runPipeline(options?: PipelineOptions): Promise<PipelineResult>;
  stopPipeline(): Promise<void>;
  pausePipeline(): Promise<void>;
  resumePipeline(): Promise<void>;
  getMetrics(): PipelineMetrics;
  getStatus(): PipelineStatus;
}

export type PipelineStatus = 'idle' | 'running' | 'paused' | 'stopping' | 'stopped' | 'completed' | 'failed';

export type PipelineStage = 'scraping' | 'processing' | 'storage' | 'migration';

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