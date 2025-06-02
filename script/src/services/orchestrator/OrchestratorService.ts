/**
 * @file OrchestratorService.ts
 * @description Part of NSW Government Jobs ETL Refactoring
 * 
 * Implementation of the orchestrator service.
 * This service coordinates the ETL pipeline components and manages the overall process.
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
import { Logger } from '../../utils/logger.js';
import { chunk, delay } from '../../utils/helpers.js';
import {
  IOrchestratorService,
  OrchestratorConfig,
  PipelineMetrics,
  PipelineResult,
  PipelineOptions,
  PipelineStatus,
  PipelineState,
  PipelineError
} from './types.js';
import { JobDetails, JobListing } from '../spider/types.js';
import { ProcessedJob } from '../processor/types.js';

type BatchResult<T, F> = {
  success: T[];
  failed: F[];
};

export class OrchestratorService implements IOrchestratorService {
  private state: PipelineState;
  private stopRequested: boolean = false;
  private pauseRequested: boolean = false;

  constructor(
    private config: OrchestratorConfig,
    private spider: SpiderService,
    private processor: ProcessorService,
    private storage: StorageService,
    private logger: Logger
  ) {
    this.state = {
      status: 'idle',
      currentBatch: 0,
      totalBatches: 0,
      currentStage: 'scraping',
      metrics: {
        jobsScraped: 0,
        jobsProcessed: 0,
        jobsStored: 0,
        failedScrapes: 0,
        failedProcesses: 0,
        failedStorage: 0,
        startTime: new Date(),
        errors: []
      }
    };
  }

  /**
   * Run the ETL pipeline
   */
  async runPipeline(options?: PipelineOptions): Promise<PipelineResult> {
    try {
      await this.initializePipeline(options);
      
      this.logger.info('=== Pipeline Options ===');
      this.logger.info('Initial options:', options);
      this.logger.info('State options:', this.state.options);
      
      // Scrape jobs
      const { success: scrapedJobs, failed: failedScrapes } = await this.scrapeJobs(this.state.options);
      this.logger.info(`Storing ${scrapedJobs.length} jobs in staging database`);

      // Process jobs
      const processedJobs = await this.processJobs(scrapedJobs, this.state.options);
      
      // Store jobs
      await this.storeJobs(processedJobs, this.state.options);

      // Complete pipeline
      this.logger.info('Completing pipeline...');
      await this.cleanup();

      // Return final result
      return {
        status: this.stopRequested ? 'stopped' : 'completed',
        metrics: {
          ...this.state.metrics,
          endTime: new Date(),
          totalDuration: Date.now() - this.state.metrics.startTime.getTime(),
          scraping: {
            total: scrapedJobs.length + failedScrapes.length,
            successful: scrapedJobs.length,
            failed: failedScrapes.length
          },
          processing: {
            total: processedJobs.length,
            successful: processedJobs.length,
            failed: 0
          },
          storage: {
            total: processedJobs.length,
            successful: processedJobs.length,
            failed: 0,
            migratedToLive: 0
          }
        },
        jobs: {
          scraped: scrapedJobs,
          processed: processedJobs,
          stored: processedJobs,
          failed: {
            scraping: failedScrapes,
            processing: [],
            storage: []
          }
        }
      };

    } catch (error) {
      this.logger.error('Pipeline failed:', error);
      this.addError('scraping', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Stop the pipeline
   */
  async stopPipeline(): Promise<void> {
    this.logger.info('Stopping pipeline...');
    this.stopRequested = true;
    this.state.status = 'stopping';
    
    // Wait for current operations to complete
    while (this.state.status === 'stopping' || this.state.status === 'running') {
      await delay(1000);
    }
    
    this.stopRequested = false;
  }

  /**
   * Pause the pipeline
   */
  async pausePipeline(): Promise<void> {
    this.logger.info('Pausing pipeline...');
    this.pauseRequested = true;
    this.state.status = 'paused';
  }

  /**
   * Resume the pipeline
   */
  async resumePipeline(): Promise<void> {
    this.logger.info('Resuming pipeline...');
    this.pauseRequested = false;
    this.state.status = 'running';
  }

  /**
   * Get current pipeline metrics
   */
  getMetrics(): PipelineMetrics {
    return {
      ...this.state.metrics,
      endTime: new Date(),
      totalDuration: Date.now() - this.state.metrics.startTime.getTime()
    };
  }

  /**
   * Get current pipeline status
   */
  getStatus(): PipelineStatus {
    return this.state.status;
  }

  /**
   * Initialize the pipeline
   */
  private async initializePipeline(options?: PipelineOptions): Promise<void> {
    this.state = {
      status: 'running',
      currentBatch: 0,
      totalBatches: 0,
      currentStage: 'scraping',
      options,
      metrics: {
        jobsScraped: 0,
        jobsProcessed: 0,
        jobsStored: 0,
        failedScrapes: 0,
        failedProcesses: 0,
        failedStorage: 0,
        startTime: new Date(),
        errors: []
      }
    };

    this.stopRequested = false;
    this.pauseRequested = false;
    
    // Only use MAX_RECORDS from environment
    this.logger.info('=== Pipeline Initialization ===');
    this.logger.info(`MAX_RECORDS environment variable: ${process.env.MAX_RECORDS}`);
    const maxRecords = process.env.MAX_RECORDS ? parseInt(process.env.MAX_RECORDS, 10) : 0;
    this.logger.info(`Parsed maxRecords: ${maxRecords}`);
    
    // Update options with environment variable
    this.state.options = {
      ...options,
      maxRecords
    };
    
    // Log initialization with maxRecords value
    this.logger.info('Pipeline initialized', { 
      maxRecords,
      maxRecordsEnabled: maxRecords > 0 ? 'yes' : 'no',
      maxRecordsSource: 'environment'
    });

    try {
      // Initialize all services
      await this.storage.initialize();
      await this.processor.initialize();
      // Spider initialization happens automatically when needed
    } catch (error) {
      this.logger.error('Error during pipeline initialization:', error);
      throw error;
    }
  }

  /**
   * Wait for pipeline to resume
   */
  private async waitForResume(): Promise<void> {
    while (this.pauseRequested) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Scrape jobs from the source
   */
  private async scrapeJobs(options?: PipelineOptions): Promise<{ success: JobDetails[]; failed: JobDetails[] }> {
    this.state.currentStage = 'scraping';
    const maxRecords = options?.maxRecords || 0;
    
    this.logger.info('=== Starting Job Scraping ===');
    this.logger.info(`maxRecords: ${maxRecords}`);
    this.logger.info(`default batch size: ${this.config.batchSize}`);
    
    const listings = await this.spider.getJobListings();
    this.logger.info(`Total listings found: ${listings.length}`);

    const jobResults = {
      success: [] as JobDetails[],
      failed: [] as JobDetails[]
    };

    // Use maxRecords as batch size if it's smaller than config.batchSize
    const effectiveBatchSize = maxRecords > 0 ? Math.min(maxRecords, this.config.batchSize) : this.config.batchSize;
    this.logger.info(`Using effective batch size: ${effectiveBatchSize}`);

    // Process job listings in batches
    for (let i = 0; i < listings.length; i += effectiveBatchSize) {
      this.logger.info('\n=== Starting New Batch ===');
      this.logger.info(`Current position: ${i}`);
      this.logger.info(`Successful jobs so far: ${jobResults.success.length}`);
      
      if (this.stopRequested) {
        this.logger.info('Stop requested, breaking out of batch loop');
        break;
      }
      if (this.pauseRequested) {
        this.logger.info('Pause requested, waiting for resume');
        await this.waitForResume();
      }

      // If we've hit our limit, stop processing
      if (maxRecords > 0 && jobResults.success.length >= maxRecords) {
        this.logger.info(`Hit maxRecords limit (${maxRecords}), breaking out of batch loop`);
        break;
      }

      // Calculate remaining records to process
      const remainingToProcess = maxRecords > 0 ? 
        Math.min(effectiveBatchSize, maxRecords - jobResults.success.length) : 
        effectiveBatchSize;
      
      this.logger.info(`Remaining records to process: ${remainingToProcess}`);

      // Get next batch, limited by remaining records
      const batch = listings.slice(i, i + remainingToProcess);
      this.logger.info(`Current batch size: ${batch.length}`);
      this.logger.info('Batch contents:');
      batch.forEach(job => this.logger.info(`- ${job.id}: ${job.title}`));

      this.state.currentBatch = i + 1;
      this.state.totalBatches = Math.ceil(listings.length / effectiveBatchSize);

      this.logger.info('\n=== Processing Batch Results ===');
      const batchResults = await Promise.allSettled(
        batch.map(async job => {
          try {
            this.logger.info(`Starting to process job: ${job.id}`);
            const result = await this.spider.getJobDetails(job);
            this.logger.info(`Successfully processed job: ${job.id}`);
            return result;
          } catch (error) {
            this.logger.error(`Failed to process job ${job.id}:`, error);
            this.addError('scraping', error, job.id);
            throw error;
          }
        })
      );

      // Process batch results
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        if (result.status === 'fulfilled') {
          this.logger.info(`Adding successful job to results: ${batch[j].id}`);
          jobResults.success.push(result.value);
          this.state.metrics.jobsScraped++;
          this.logger.info(`Current successful jobs count: ${jobResults.success.length}`);
        } else {
          this.logger.info(`Adding failed job to results: ${batch[j].id}`);
          // Create a failed JobDetails object with minimal information
          const failedJob: JobDetails = {
            ...batch[j],
            description: '',
            responsibilities: [],
            requirements: [],
            notes: [],
            aboutUs: '',
            contactDetails: {
              name: '',
              phone: '',
              email: ''
            }
          };
          jobResults.failed.push(failedJob);
          this.state.metrics.failedScrapes++;
          this.addError('scraping', result.reason, batch[j].id);
        }

        // If we've hit our limit after processing this result, break out
        if (maxRecords > 0 && jobResults.success.length >= maxRecords) {
          this.logger.info(`Hit maxRecords limit (${maxRecords}) after processing job, breaking out`);
          break;
        }
      }

      // Update metrics
      this.state.metrics.scraping = {
        total: listings.length,
        successful: jobResults.success.length,
        failed: jobResults.failed.length
      };

      this.logger.info('\n=== Batch Summary ===');
      this.logger.info(`Successful jobs: ${jobResults.success.length}`);
      this.logger.info(`Failed jobs: ${jobResults.failed.length}`);
      this.logger.info(`Progress: ${i + batch.length}/${listings.length} (${Math.round(((i + batch.length) / listings.length) * 100)}%)`);
    }

    this.logger.info('\n=== Final Results ===');
    this.logger.info(`Total successful jobs: ${jobResults.success.length}`);
    this.logger.info(`Total failed jobs: ${jobResults.failed.length}`);
    return jobResults;
  }

  /**
   * Process scraped jobs
   */
  private async processJobs(jobs: JobDetails[], options?: PipelineOptions): Promise<ProcessedJob[]> {
    this.state.currentStage = 'processing';
    const success: ProcessedJob[] = [];
    const failed: JobDetails[] = [];

    // Apply maxRecords limit if specified
    const maxRecords = options?.maxRecords || 0;
    const limitedJobs = maxRecords > 0 ? jobs.slice(0, maxRecords) : jobs;
    this.logger.info(`Processing ${limitedJobs.length} jobs${maxRecords > 0 ? ` (limited by maxRecords=${maxRecords})` : ''}`);

    const batches = chunk(limitedJobs, this.config.batchSize);
    this.state.totalBatches = batches.length;

    for (const [index, batch] of batches.entries()) {
      if (this.stopRequested) break;
      while (this.pauseRequested) await delay(1000);

      this.state.currentBatch = index + 1;
      const results = await this.processor.processBatch(batch);

      results.forEach((result, i) => {
        if (result) {
          success.push(result);
          this.state.metrics.jobsProcessed++;
        } else {
          failed.push(batch[i]);
          this.state.metrics.failedProcesses++;
          this.addError('processing', 'Processing failed', batch[i].id);
        }
      });
    }

    // Apply maxRecords limit again to be safe
    return maxRecords > 0 ? success.slice(0, maxRecords) : success;
  }

  /**
   * Store jobs and migrate to live DB if enabled
   */
  private async storeJobs(jobs: ProcessedJob[], options?: PipelineOptions): Promise<void> {
    this.state.currentStage = 'storage';

    try {
      // Apply maxRecords limit if specified
      const maxRecords = options?.maxRecords || 0;
      const limitedJobs = maxRecords > 0 ? jobs.slice(0, maxRecords) : jobs;
      
      // Store in staging DB
      this.logger.info(`Storing ${limitedJobs.length} jobs in staging database${maxRecords > 0 ? ` (limited by maxRecords=${maxRecords})` : ''}`);
      const batches = chunk(limitedJobs, this.config.batchSize);
      
      for (const batch of batches) {
        if (this.stopRequested) break;
        await this.waitForResume();

        try {
          await this.storage.storeBatch(batch);
          this.state.metrics.jobsStored += batch.length;
          this.logger.info(`Successfully stored batch of ${batch.length} jobs`);
        } catch (error) {
          this.state.metrics.failedStorage += batch.length;
          this.addError('storage', error);
          this.logger.error('Error storing batch:', error);
        }
      }

      // Migrate to live DB if enabled
      if (this.state.options?.migrateToLive && limitedJobs.length > 0) {
        this.state.currentStage = 'migration';
        this.logger.info(`Migrating ${limitedJobs.length} jobs to live database`);
        try {
          await this.storage.migrateBatchToLive(limitedJobs);
          this.logger.info('Successfully migrated jobs to live database');
        } catch (error) {
          this.addError('migration', error);
          this.logger.error('Error migrating to live database:', error);
          // Don't mark jobs as failed if staging storage succeeded
        }
      }

    } catch (error) {
      this.addError('storage', error);
      this.logger.error('Error in storage stage:', error);
    }
  }

  /**
   * Filter jobs based on pipeline options
   */
  private filterJobs(jobs: JobListing[], options?: PipelineOptions): JobListing[] {
    if (!options) return jobs;

    return jobs.filter(job => {
      const postedDate = new Date(job.postedDate);
      
      const matchesDateRange = (!options.startDate || postedDate >= options.startDate) &&
        (!options.endDate || postedDate <= options.endDate);

      const matchesAgency = !options.agencies?.length ||
        options.agencies.includes(job.agency);

      const matchesLocation = !options.locations?.length ||
        options.locations.includes(job.location);

      return matchesDateRange && matchesAgency && matchesLocation;
    });
  }

  /**
   * Complete the pipeline
   */
  private async cleanup(): Promise<void> {
    this.logger.info('Completing pipeline...');
    this.state.status = 'completed';
    
    // Clean up all services
    try {
      await this.spider.cleanup();
      await this.processor.cleanup();
      await this.storage.cleanup();
      this.logger.info('Successfully cleaned up all services');
    } catch (error) {
      this.logger.error('Error during service cleanup:', error);
    }
  }

  /**
   * Handle pipeline errors
   */
  private handlePipelineError(error: any): void {
    this.state.status = 'failed';
    this.addError(this.state.currentStage, error);
    this.logger.error('Pipeline failed:', error);
  }

  /**
   * Add an error to the pipeline metrics
   */
  private addError(stage: PipelineError['stage'], error: any, jobId?: string): void {
    const pipelineError: PipelineError = {
      stage,
      error: error instanceof Error ? error.message : String(error),
      jobId,
      timestamp: new Date()
    };

    this.state.metrics.errors.push(pipelineError);
    this.state.lastError = pipelineError;
  }
} 