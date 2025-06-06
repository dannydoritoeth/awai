/**
 * @file ProcessorService.ts
 * @description Part of NSW Government Jobs ETL Refactoring
 * 
 * Implementation of the job processor service.
 * This service coordinates the analysis and embedding generation
 * for job listings while maintaining the same processing logic
 * as the current implementation.
 * 
 * @module services/processor
 * @see RefactorETL.md for the complete refactoring plan
 * 
 * @author AWAI Team
 * @version 1.0.0
 * @since 2024-02-06
 */

import { AIAnalyzer } from '../analyzer/AIAnalyzer.js';
import { EmbeddingService } from '../embeddings/EmbeddingService.js';
import { JobDetails } from '../spider/types.js';
import { Logger } from '../../utils/logger.js';
import { retry, chunk } from '../../utils/helpers.js';
import { CapabilityAnalysisResult, TaxonomyAnalysisResult } from '../analyzer/templates/capabilityAnalysis.js';
import {
  IProcessorService,
  ProcessorConfig,
  ProcessedJob,
  ProcessingMetrics,
  ProcessingError,
  ProcessingStatus
} from './types.js';
import { StorageService } from '../storage/StorageService.js';

interface FrameworkCapability {
  id: string;
  name: string;
  description: string;
  group_name: string;
  embedding?: any;
}

interface ProcessedCapability {
  id: string;
  name: string;
  level: "foundational" | "intermediate" | "adept" | "advanced" | "highly advanced";
  description: string;
  relevance: number;
  embedding?: any;
}

export class ProcessorService implements IProcessorService {
  private metrics: ProcessingMetrics;
  private processingTimes: number[] = [];
  private frameworkCapabilities: FrameworkCapability[] = [];

  constructor(
    private config: ProcessorConfig,
    private logger: Logger,
    private analyzer: AIAnalyzer,
    private embeddingService: EmbeddingService,
    private storageService: StorageService
  ) {
    // Initialize metrics first
    this.metrics = {
      totalProcessed: 0,
      successfulProcesses: 0,
      failedProcesses: 0,
      averageProcessingTime: 0,
      errors: []
    };
    this.processingTimes = [];
    this.frameworkCapabilities = [];

    // Now we can use the logger
    this.logger.info('ProcessorService initialized');
  }

  /**
   * Initialize the processor service
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Loading capability framework...');
      this.frameworkCapabilities = await this.loadCapabilityFramework();
      
      // Pass the loaded capabilities to the analyzer
      await this.analyzer.setFrameworkCapabilities(this.frameworkCapabilities);
      
      // Load and set taxonomy groups
      this.logger.info('Loading taxonomy groups...');
      const taxonomyGroups = await this.storageService.getTaxonomyGroups();
      await this.analyzer.setTaxonomyGroups(taxonomyGroups);
      
      this.logger.info('Processor service initialized');
    } catch (error) {
      this.logger.error('Error initializing processor service:', error);
      throw error;
    }
  }

  /**
   * Load capability framework and generate embeddings
   */
  private async loadCapabilityFramework(): Promise<FrameworkCapability[]> {
    try {
      // Load capabilities from staging database
      const capabilities = await this.storageService.getFrameworkCapabilities();

      if (!capabilities || capabilities.length === 0) {
        this.logger.warn('No capabilities found in framework');
        return [];
      }

      // Filter capabilities that need embeddings
      const capabilitiesNeedingEmbeddings = capabilities.filter(cap => !cap.embedding);
      
      if (capabilitiesNeedingEmbeddings.length > 0) {
        this.logger.info(`Generating embeddings for ${capabilitiesNeedingEmbeddings.length} capabilities`);
        const newEmbeddings = await Promise.all(
          capabilitiesNeedingEmbeddings.map(async cap => ({
            ...cap,
            embedding: await this.embeddingService.generateCapabilityEmbedding(cap.description)
          }))
        );

        // Store the new embeddings
        await this.storageService.storeCapabilityEmbeddings(newEmbeddings);

        // Update the capabilities array with new embeddings
        for (const newCap of newEmbeddings) {
          const index = capabilities.findIndex(cap => cap.id === newCap.id);
          if (index !== -1) {
            capabilities[index] = newCap;
          }
        }
      } else {
        this.logger.info('All capabilities already have embeddings');
      }

      this.logger.info(`Successfully loaded ${capabilities.length} capabilities with embeddings`);
      this.frameworkCapabilities = capabilities;
      return capabilities;
    } catch (error) {
      this.logger.error('Error in loadCapabilityFramework:', error);
      throw error;
    }
  }

  /**
   * Process a single job
   */
  async processJob(job: JobDetails): Promise<ProcessedJob | undefined> {
    try {
      this.logger.info(`Starting processing for job ${job.id}: ${job.title}`);

      // Check if job already exists and is synced
      const existingJob = await this.storageService.checkJobStatus(job.id);
      if (existingJob.exists && existingJob.status === 'synced') {
        this.logger.info(`Job ${job.id} already exists and is synced, skipping processing`);
        return undefined;
      }

      // Get or create role first
      const roleData = await this.storageService.getRoleByJobDetails(job);
      if (!roleData) {
        throw new Error('Failed to get or create role');
      }
      this.logger.info(`Found role ID ${roleData.id} for job ${job.id}`);
      job.roleId = roleData.id;

      // Process capabilities and taxonomies together
      this.logger.info(`Analyzing capabilities and taxonomies for job ${job.id}`);
      const analysis = await this.analyzer.analyzeCapabilities(job);
      this.logger.info(`Found ${analysis.capabilities.length} capabilities and ${analysis.taxonomies.length} taxonomies for job ${job.id}`);

      // Store role-taxonomy relationships
      if (analysis.taxonomies.length > 0) {
        await this.storageService.storeRoleTaxonomies(
          analysis.taxonomies.map(tax => ({
            roleId: roleData.id,
            taxonomyId: tax.id
          }))
        );
      }

      const processedJob: ProcessedJob = {
        jobDetails: job,
        capabilities: analysis,
        taxonomy: {
          taxonomyIds: analysis.taxonomies.map(t => t.id),
          roleId: roleData.id
        },
        embeddings: {
          job: { 
            vector: [], 
            text: '', 
            metadata: {
              source: 'placeholder',
              timestamp: new Date().toISOString(),
              model: 'text-embedding-ada-002'
            }
          },
          capabilities: [],
          skills: []
        },
        metadata: {
          processedAt: new Date().toISOString(),
          version: this.config.version,
          status: 'completed'
        }
      };

      this.metrics.successfulProcesses++;
      this.metrics.totalProcessed++;
      
      this.logger.info(`Successfully processed job ${job.id}`);

      return processedJob;

    } catch (error) {
      this.metrics.failedProcesses++;
      this.handleProcessingError(error, job.id);
      return undefined;
    }
  }

  /**
   * Process a batch of jobs
   */
  async processBatch(jobs: JobDetails[]): Promise<(ProcessedJob | undefined)[]> {
    this.logger.info(`Processing batch of ${jobs.length} jobs`);
    const batchStartTime = Date.now();

    try {
      // Process jobs in parallel with a concurrency limit
      const batchSize = this.config.batchSize || 10;
      const batches = chunk(jobs, batchSize);
      const results: (ProcessedJob | undefined)[] = [];

      for (const batch of batches) {
        // Process each batch sequentially to avoid too many concurrent requests
        const batchResults = await Promise.all(
          batch.map(job => this.processJob(job).catch(error => {
            this.handleProcessingError(error, job.id);
            return undefined;
          }))
        );
        results.push(...batchResults);
      }

      this.updateMetrics(batchStartTime);
      return results;

    } catch (error) {
      this.logger.error('Error processing batch:', error);
      throw error;
    }
  }

  /**
   * Handle processing errors with detailed context
   */
  private handleProcessingError(error: any, jobId: string): void {
    const errorDetails: ProcessingError = {
      stage: error.stage || 'analysis',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      context: {
        jobId,
        stack: error instanceof Error ? error.stack : undefined,
        cause: error instanceof Error ? error.cause : undefined
      }
    };

    this.metrics.errors.push(errorDetails);
    this.logger.error(`Processing error for job ${jobId}: ${errorDetails.error}`, {
      context: errorDetails.context
    });
  }

  /**
   * Get current processing metrics
   */
  getMetrics(): ProcessingMetrics {
    return this.metrics;
  }

  /**
   * Retry an operation with configured retry settings
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    stage: ProcessingError['stage']
  ): Promise<T> {
    try {
      return await retry(
        operation,
        this.config.maxRetries,
        this.config.retryDelay
      );
    } catch (error) {
      const processingError: ProcessingError = {
        stage,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      this.metrics.errors.push(processingError);
      throw error;
    }
  }

  /**
   * Update metrics with processing time
   */
  private updateMetrics(startTime: number): void {
    const processingTime = Date.now() - startTime;
    this.processingTimes.push(processingTime);
    this.metrics.totalProcessed++;
    this.metrics.averageProcessingTime = 
      this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      // Clean up analyzer and embedding service
      await this.analyzer.cleanup();
      await this.embeddingService.cleanup();
      this.logger.info('Successfully cleaned up processor service');
    } catch (error) {
      this.logger.error('Error cleaning up processor service:', error);
    }
  }
} 