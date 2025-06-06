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
  PipelineError,
  LoggedProcessedJob
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
      
      const mode = options?.pipelineMode || 'all';
      this.logger.info('Running pipeline in mode:', mode);

      let scrapedJobs: JobDetails[] = [];
      let processedJobs: ProcessedJob[] = [];
      let failedScrapes: JobDetails[] = [];

      // Scraping phase
      if (mode === 'scrapeOnly' || mode === 'all') {
        const scrapeResult = await this.scrapeJobs(this.state.options);
        scrapedJobs = scrapeResult.success;
        failedScrapes = scrapeResult.failed;
        
        if (mode === 'scrapeOnly') {
          // Return early with just scraping results
          return {
            status: this.stopRequested ? 'stopped' as const : 'completed' as const,
            metrics: {
              ...this.state.metrics,
              endTime: new Date(),
              totalDuration: Date.now() - this.state.metrics.startTime.getTime(),
              scraping: {
                total: scrapedJobs.length + failedScrapes.length,
                successful: scrapedJobs.length,
                failed: failedScrapes.length
              },
              processing: { total: 0, successful: 0, failed: 0 },
              storage: { total: 0, successful: 0, failed: 0, migratedToLive: 0 }
            },
            jobs: {
              scraped: scrapedJobs.map(job => ({
                ...job,
                documents: []
              })),
              processed: [],
              stored: [],
              failed: {
                scraping: failedScrapes.map(job => ({
                  ...job,
                  documents: []
                })),
                processing: [],
                storage: []
              }
            }
          };
        }
      }

      // Processing phase
      if (mode === 'processOnly' || mode === 'all') {
        // If in processOnly mode and no jobs provided, return empty result
        if (mode === 'processOnly' && scrapedJobs.length === 0) {
          this.logger.warn('No jobs provided for processing in processOnly mode');
          return {
            status: 'completed' as const,
            metrics: {
              ...this.state.metrics,
              endTime: new Date(),
              totalDuration: Date.now() - this.state.metrics.startTime.getTime(),
              scraping: { total: 0, successful: 0, failed: 0 },
              processing: { total: 0, successful: 0, failed: 0 },
              storage: { total: 0, successful: 0, failed: 0, migratedToLive: 0 }
            },
            jobs: {
              scraped: [],
              processed: [],
              stored: [],
              failed: {
                scraping: [],
                processing: [],
                storage: []
              }
            }
          };
        }

        processedJobs = await this.processJobs(scrapedJobs, this.state.options);
        
        // Store jobs
        await this.storeJobs(processedJobs, this.state.options);
      }

      // Complete pipeline
      this.logger.info('Completing pipeline...');
      await this.cleanup();

      // Return final result
      return {
        status: this.stopRequested ? 'stopped' as const : 'completed' as const,
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
          scraped: scrapedJobs.map(job => ({
            ...job,
            documents: []
          })),
          processed: processedJobs.map(job => ({
            ...job,
            embeddings: {
              job: { ...job.embeddings?.job || { vector: [], text: '' }, vector: '[vector data hidden]' },
              capabilities: (job.embeddings?.capabilities || []).map(e => ({ ...e, vector: '[vector data hidden]' })),
              skills: (job.embeddings?.skills || []).map(e => ({ ...e, vector: '[vector data hidden]' }))
            }
          })) as LoggedProcessedJob[],
          stored: processedJobs.map(job => ({
            ...job,
            embeddings: {
              job: { ...job.embeddings?.job || { vector: [], text: '' }, vector: '[vector data hidden]' },
              capabilities: (job.embeddings?.capabilities || []).map(e => ({ ...e, vector: '[vector data hidden]' })),
              skills: (job.embeddings?.skills || []).map(e => ({ ...e, vector: '[vector data hidden]' }))
            }
          })) as LoggedProcessedJob[],
          failed: {
            scraping: failedScrapes.map(job => ({
              ...job,
              documents: []
            })),
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
  stop(): void {
    this.logger.info('Stop requested');
    this.stopRequested = true;
    this.state.status = 'stopped';
  }

  /**
   * Pause the pipeline
   */
  pause(): void {
    this.logger.info('Pause requested');
    this.pauseRequested = true;
    this.state.status = 'paused';
  }

  /**
   * Resume the pipeline
   */
  resume(): void {
    this.logger.info('Resume requested');
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
   * Wait for resume if paused
   */
  private async waitForResume(): Promise<void> {
    while (this.pauseRequested && !this.stopRequested) {
      await delay(1000);
    }
  }

  /**
   * Scrape jobs from the source
   */
  private async scrapeJobs(options?: PipelineOptions): Promise<{ success: JobDetails[]; failed: JobDetails[] }> {
    this.state.currentStage = 'scraping';
    
    try {
      // Get job listings
      const maxRecordsLimit = options?.maxRecords || 0;
      this.logger.info(`Scraping jobs${maxRecordsLimit > 0 ? ` (limit: ${maxRecordsLimit})` : ''}...`);
      const jobListings = await this.spider.getJobListings(maxRecordsLimit);
      this.logger.info(`Found ${jobListings.length} job listings`);

      // Get job details for each listing
      const success: JobDetails[] = [];
      const failed: JobDetails[] = [];
      const skipped: JobDetails[] = [];
      const batchSize = this.config.batchSize || 10;
      const batches = chunk(jobListings, batchSize);

      for (const batch of batches) {
        if (this.stopRequested) {
          this.logger.info('Stop requested, halting job scraping');
          break;
        }

        await this.waitForResume();

        try {
          // Check which jobs should be skipped
          const skipChecks = await Promise.all(
            batch.map(async listing => {
              const shouldSkip = await this.storage.shouldSkipScraping(listing.id);
              if (shouldSkip) {
                const status = await this.storage.checkJobStatus(listing.id);
                this.logger.info(`Skipping job ${listing.id} (${listing.title}) - already exists with status: ${status.status}`);
                skipped.push(listing);
              }
              return shouldSkip;
            })
          );

          // Filter out jobs that should be skipped
          const jobsToScrape = batch.filter((_, index) => !skipChecks[index]);
          
          if (jobsToScrape.length < batch.length) {
            const skippedCount = batch.length - jobsToScrape.length;
            this.logger.info(`Batch summary: ${skippedCount} jobs skipped (already processed or pending), ${jobsToScrape.length} jobs to scrape`);
          }

          if (jobsToScrape.length === 0) {
            this.logger.info('Skipping entire batch - all jobs already processed or pending');
            continue;
          }

          // Process remaining jobs
          const batchResults = await Promise.allSettled(
            jobsToScrape.map(listing => this.spider.getJobDetails(listing))
          );

          // Handle results
          batchResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              success.push(result.value);
              this.state.metrics.jobsScraped++;
            } else {
              const failedJob = {
                ...jobsToScrape[index],
                error: result.reason,
                description: '',
                responsibilities: [],
                requirements: [],
                notes: [],
                aboutUs: '',
                contactDetails: { name: '', phone: '', email: '' },
                documents: []
              } as JobDetails;
              failed.push(failedJob);
              this.state.metrics.failedScrapes++;
              this.addError('scraping', result.reason, jobsToScrape[index].id);
            }
          });

          this.logger.info(`Batch progress: ${success.length + failed.length + skipped.length}/${jobListings.length} jobs processed (${skipped.length} skipped)`);
        } finally {
          // Cleanup after each batch to prevent browser instance accumulation
          await this.spider.cleanup();
        }
      }

      // Log final results
      this.logger.info('Job scraping complete:');
      this.logger.info(`- Succeeded: ${success.length} jobs`);
      this.logger.info(`- Failed: ${failed.length} jobs`);
      this.logger.info(`- Skipped: ${skipped.length} jobs (already processed or pending)`);
      return { success, failed };

    } catch (error) {
      this.logger.error('Error during job scraping:', error);
      this.addError('scraping', error);
      throw error;
    }
  }

  /**
   * Process scraped jobs
   */
  private async processJobs(jobs: JobDetails[], options?: PipelineOptions): Promise<ProcessedJob[]> {
    this.state.currentStage = 'processing';
    const success: ProcessedJob[] = [];
    const failed: JobDetails[] = [];
    const skipped: JobDetails[] = [];

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

      // Check which jobs should be skipped
      const skipChecks = await Promise.all(
        batch.map(async job => {
          const shouldSkip = await this.storage.shouldSkipProcessing(job.id);
          if (shouldSkip) {
            this.logger.info(`Skipping job ${job.id} (${job.title}) - already processed`);
            skipped.push(job);
          }
          return shouldSkip;
        })
      );

      // Filter out jobs that should be skipped
      const jobsToProcess = batch.filter((_, index) => !skipChecks[index]);
      
      if (jobsToProcess.length < batch.length) {
        const skippedCount = batch.length - jobsToProcess.length;
        this.logger.info(`Batch ${index + 1} summary: ${skippedCount} jobs skipped (already processed), ${jobsToProcess.length} jobs to process`);
      }

      if (jobsToProcess.length === 0) {
        this.logger.info(`Skipping batch ${index + 1} - all jobs already processed`);
        continue;
      }

      const results = await this.processor.processBatch(jobsToProcess);

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

      this.logger.info(`Batch ${index + 1} complete: ${success.length + failed.length + skipped.length}/${limitedJobs.length} jobs handled (${skipped.length} skipped)`);
    }

    // Log final processing results
    this.logger.info('Job processing complete:');
    this.logger.info(`- Succeeded: ${success.length} jobs`);
    this.logger.info(`- Failed: ${failed.length} jobs`);
    this.logger.info(`- Skipped: ${skipped.length} jobs (already processed)`);

    // Apply maxRecords limit again to be safe
    return maxRecords > 0 ? success.slice(0, maxRecords) : success;
  }

  /**
   * Store jobs in staging DB
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
          // Convert ProcessedJob to StorageJob type
          const storageJobs = batch.map(job => ({
            ...job,
            capabilities: {
              capabilities: job.capabilities.capabilities.map(cap => ({
                id: cap.id,
                name: cap.name,
                level: cap.level,
                description: cap.description,
                behavioral_indicators: []
              })),
              occupationalGroups: job.capabilities.occupationalGroups,
              focusAreas: job.capabilities.focusAreas,
              skills: job.capabilities.skills.map(skill => ({
                name: skill.name,
                description: skill.description,
                category: skill.category
              })),
              taxonomies: job.capabilities.taxonomies,
              generalRole: job.capabilities.generalRole
            },
            taxonomy: {
              technicalSkills: job.capabilities.skills
                .filter(s => s.category === 'Technical')
                .map(s => s.name),
              softSkills: job.capabilities.skills
                .filter(s => s.category === 'Soft Skills')
                .map(s => s.name)
            }
          }));
          
          await this.storage.storeBatch(storageJobs);
          this.state.metrics.jobsStored += batch.length;
          this.logger.info(`Successfully stored batch of ${batch.length} jobs`);
        } catch (error) {
          this.state.metrics.failedStorage += batch.length;
          this.addError('storage', error);
          this.logger.error('Error storing batch:', error);
        }
      }

    } catch (error) {
      this.addError('storage', error);
      this.logger.error('Error in storage stage:', error);
    }
  }

  /**
   * Filter jobs based on options
   */
  private filterJobs(jobs: JobDetails[], options?: PipelineOptions): JobDetails[] {
    if (!options) return jobs;

    // Apply maxRecords limit if specified
    const maxRecords = options.maxRecords || 0;
    return maxRecords > 0 ? jobs.slice(0, maxRecords) : jobs;
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    try {
      await this.spider.cleanup();
      await this.processor.cleanup();
      await this.storage.cleanup();
      this.logger.info('Successfully cleaned up all services');
    } catch (error) {
      this.logger.error('Error during cleanup:', error);
      throw error;
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

  /**
   * Validate pipeline options
   */
  private validateOptions(options?: PipelineOptions): void {
    if (!options) return;

    // Validate maxRecords
    if (options.maxRecords !== undefined && options.maxRecords <= 0) {
      throw new Error('maxRecords must be greater than 0');
    }

    // Validate skipProcessing and skipStorage
    if (options.skipProcessing && !options.skipStorage) {
      throw new Error('Cannot skip processing without skipping storage');
    }

    // Validate migrateToLive
    if (options.migrateToLive && (options.skipProcessing || options.skipStorage)) {
      throw new Error('Cannot migrate to live DB when skipping processing or storage');
    }
  }
} 