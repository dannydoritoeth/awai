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
      this.logger.info('Starting pipeline execution');

      // Scrape jobs (this now includes processing and storage per batch)
      const { success: scrapedJobs, failed: failedJobs } = await this.scrapeJobs(options);
      
      // Update final metrics
      const endTime = new Date();
      const totalDuration = endTime.getTime() - this.state.metrics.startTime.getTime();
      
      const result: PipelineResult = {
        status: this.stopRequested ? 'stopped' : 'completed',
        metrics: {
          ...this.state.metrics,
          endTime,
          totalDuration,
          scraping: {
            total: scrapedJobs.length + failedJobs.length,
            successful: scrapedJobs.length,
            failed: failedJobs.length
          },
          processing: {
            total: scrapedJobs.length,
            successful: scrapedJobs.length,
            failed: 0
          },
          storage: {
            total: scrapedJobs.length,
            successful: scrapedJobs.length,
            failed: 0,
            migratedToLive: 0
          }
        },
        jobs: {
          scraped: scrapedJobs.map(job => ({
            ...job,
            documents: []
          })),
          processed: scrapedJobs.map(job => ({
            jobDetails: job,
            capabilities: {
              capabilities: [],
              occupationalGroups: [],
              focusAreas: [],
              skills: [],
              taxonomies: [],
              generalRole: {
                id: '',
                name: '',
                title: '',
                description: '',
                confidence: 0,
                isNewRole: true
              }
            },
            taxonomy: {
              taxonomyIds: [],
              roleId: job.roleId || ''
            },
            embeddings: {
              job: { vector: '[vector data hidden]', text: '' },
              capabilities: [],
              skills: []
            },
            metadata: {
              processedAt: new Date().toISOString(),
              version: '1.0.0',
              status: 'completed'
            }
          })) as LoggedProcessedJob[],
          stored: scrapedJobs.map(job => ({
            jobDetails: job,
            capabilities: {
              capabilities: [],
              occupationalGroups: [],
              focusAreas: [],
              skills: [],
              taxonomies: [],
              generalRole: {
                id: '',
                name: '',
                title: '',
                description: '',
                confidence: 0,
                isNewRole: true
              }
            },
            taxonomy: {
              taxonomyIds: [],
              roleId: job.roleId || ''
            },
            embeddings: {
              job: { vector: '[vector data hidden]', text: '' },
              capabilities: [],
              skills: []
            },
            metadata: {
              processedAt: new Date().toISOString(),
              version: '1.0.0',
              status: 'completed'
            }
          })) as LoggedProcessedJob[],
          failed: {
            scraping: failedJobs.map(job => ({
              ...job,
              documents: []
            })),
            processing: [],
            storage: []
          }
        }
      };

      this.logger.info('Pipeline execution complete', result);
      return result;

    } catch (error) {
      this.state.status = 'failed';
      this.addError('scraping', error);
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
    
    // Log all pipeline options
    this.logger.info('=== Pipeline Initialization ===');
    this.logger.info('Pipeline options:', {
      maxRecords: options?.maxRecords,
      skipProcessing: options?.skipProcessing,
      skipStorage: options?.skipStorage,
      migrateToLive: options?.migrateToLive,
      scrapeOnly: options?.scrapeOnly,
      continueOnError: options?.continueOnError,
      startDate: options?.startDate,
      endDate: options?.endDate,
      agencies: options?.agencies,
      locations: options?.locations
    });
    
    // Store all options in state
    this.state.options = {
      ...options
    };
    
    // Log initialization with all options
    this.logger.info('Pipeline initialized', { 
      maxRecords: options?.maxRecords,
      maxRecordsEnabled: options?.maxRecords ? options.maxRecords > 0 : false,
      scrapeOnly: options?.scrapeOnly || false,
      maxRecordsSource: 'environment',
      allOptions: this.state.options
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
      const batchSize = this.config.batchSize || 10;
      const batches = chunk(jobListings, batchSize);
      this.state.totalBatches = batches.length;

      for (const [batchIndex, batch] of batches.entries()) {
        if (this.stopRequested) {
          this.logger.info('Stop requested, halting job scraping');
          break;
        }

        await this.waitForResume();
        this.state.currentBatch = batchIndex + 1;

        try {
          // Process each batch sequentially
          const batchResults = await Promise.allSettled(
            batch.map(listing => this.spider.getJobDetails(listing))
          );

          // Handle results and create batch arrays
          const batchSuccess: JobDetails[] = [];
          const batchFailed: JobDetails[] = [];

          batchResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              batchSuccess.push(result.value);
              this.state.metrics.jobsScraped++;
            } else {
              const failedJob = {
                ...batch[index],
                error: result.reason,
                description: '',
                responsibilities: [],
                requirements: [],
                notes: [],
                aboutUs: '',
                contactDetails: { name: '', phone: '', email: '' },
                documents: []
              } as JobDetails;
              batchFailed.push(failedJob);
              this.state.metrics.failedScrapes++;
              this.addError('scraping', result.reason, batch[index].id);
            }
          });

          // Process and store this batch immediately
          if (batchSuccess.length > 0) {
            try {
              let processedJobs: ProcessedJob[];
              
              if (options?.scrapeOnly) {
                // If scrapeOnly, just convert scraped jobs to ProcessedJob format without actual processing
                this.logger.info(`Scrape only mode - preparing batch ${batchIndex + 1} for raw storage`);
                processedJobs = batchSuccess.map(job => ({
                  jobDetails: job,
                  capabilities: {
                    capabilities: [],
                    occupationalGroups: [],
                    focusAreas: [],
                    skills: [],
                    taxonomies: [],
                    generalRole: {
                      id: '',
                      name: '',
                      title: '',
                      description: '',
                      confidence: 0,
                      isNewRole: true
                    }
                  },
                  taxonomy: {
                    taxonomyIds: [],
                    roleId: job.roleId || ''
                  },
                  embeddings: {
                    job: { vector: [], text: '' },
                    capabilities: [],
                    skills: []
                  },
                  metadata: {
                    processedAt: new Date().toISOString(),
                    version: '1.0.0',
                    status: 'completed'
                  }
                }));
                this.logger.info(`Prepared ${processedJobs.length} jobs in batch ${batchIndex + 1} for raw storage`);
              } else {
                // Process jobs normally
                processedJobs = await this.processJobs(batchSuccess, options);
              }
              
              // Store the processed jobs immediately
              if (processedJobs.length > 0 && !options?.skipStorage) {
                await this.storeJobs(processedJobs, options);
              }
              
              // Add to overall success array
              success.push(...batchSuccess);
            } catch (error) {
              this.logger.error(`Error processing/storing batch ${batchIndex + 1}:`, error);
              batchFailed.push(...batchSuccess);
              if (!options?.continueOnError) throw error;
            }
          }

          // Add failed jobs to overall failed array
          failed.push(...batchFailed);

          this.logger.info(`Batch ${batchIndex + 1}/${batches.length} complete: ${success.length + failed.length}/${jobListings.length} jobs processed`);
        } catch (error) {
          this.logger.error(`Error processing batch ${batchIndex + 1}:`, error);
          if (!options?.continueOnError) throw error;
        } finally {
          // Cleanup after each batch to prevent browser instance accumulation
          await this.spider.cleanup();
        }
      }

      // Log final results
      this.logger.info(`Job scraping complete: ${success.length} succeeded, ${failed.length} failed`);
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
      this.logger.info('Storage options:', {
        scrapeOnly: options?.scrapeOnly,
        maxRecords: options?.maxRecords,
        skipProcessing: options?.skipProcessing,
        skipStorage: options?.skipStorage,
        continueOnError: options?.continueOnError
      });
      this.logger.info('Storage mode:', options?.scrapeOnly ? 'scrapeOnly=true (raw storage only)' : 'scrapeOnly=false (full processing)');
      
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

          // If scrapeOnly is true, use storeRaw, otherwise use storeBatch
          if (options?.scrapeOnly) {
            this.logger.info(`Using storeRaw for scrapeOnly mode - processing batch of ${batch.length} jobs`);
            for (const job of storageJobs) {
              await this.storage.jobs.storeRaw(job);
              this.logger.info(`Successfully stored raw job ${job.jobDetails.id}`);
            }
            this.logger.info(`Completed raw storage for batch of ${batch.length} jobs`);
          } else {
            this.logger.info(`Using full processing mode - processing batch of ${batch.length} jobs`);
            await this.storage.storeBatch(storageJobs);
            this.logger.info(`Completed full processing for batch of ${batch.length} jobs`);
          }
          
        } catch (error) {
          this.logger.error('Error storing batch:', error);
          if (!this.state.options?.continueOnError) throw error;
        }
      }
    } catch (error) {
      this.logger.error('Error in storeJobs:', error);
      throw error;
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