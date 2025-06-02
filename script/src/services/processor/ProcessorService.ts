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

      // Process capabilities
      this.logger.info(`Analyzing capabilities for job ${job.id}`);
      const capabilities = await this.analyzer.analyzeCapabilities(job);
      this.logger.info(`Found ${capabilities.capabilities.length} capabilities for job ${job.id}`);

      // Process taxonomy
      this.logger.info(`Analyzing taxonomy for job ${job.id}`);
      const taxonomy = await this.analyzer.analyzeTaxonomy(job);
      this.logger.info(`Found ${taxonomy.technicalSkills.length} technical skills and ${taxonomy.softSkills.length} soft skills for job ${job.id}`);

      // Generate embeddings
      this.logger.info(`Generating embeddings for job ${job.id}`);
      const jobEmbedding = await this.embeddingService.generateJobEmbedding(job.description);

      // Get embeddings for the matched capabilities from our pre-generated framework embeddings
      const capabilityEmbeddings = capabilities.capabilities.map((cap: ProcessedCapability) => {
        const frameworkCap = this.frameworkCapabilities.find(fc => fc.id === cap.id);
        return frameworkCap?.embedding;
      });

      // Only generate embeddings for the skills we actually found
      const allSkills = [...taxonomy.technicalSkills, ...taxonomy.softSkills];
      this.logger.info(`Generating embeddings for ${allSkills.length} skills`);
      const skillEmbeddings = await Promise.all(
        allSkills.map(async (skill: string) => 
          this.embeddingService.generateSkillEmbedding(skill)
        )
      );

      this.logger.info(`Generated ${1 + capabilityEmbeddings.length + skillEmbeddings.length} total embeddings for job ${job.id}`);

      const processedJob: ProcessedJob = {
        jobDetails: job,
        capabilities,
        taxonomy,
        embeddings: {
          job: jobEmbedding,
          capabilities: capabilityEmbeddings,
          skills: skillEmbeddings
        },
        metadata: {
          processedAt: new Date().toISOString(),
          version: this.config.version,
          status: 'completed'
        }
      };

      this.metrics.successfulProcesses++;
      this.metrics.totalProcessed++;
      
      // Log processed job without embeddings
      this.logger.info(`Successfully processed job ${job.id}`, {
        ...processedJob,
        embeddings: {
          job: { ...jobEmbedding, vector: '[vector data hidden]' },
          capabilities: capabilityEmbeddings.map(e => ({ ...e, vector: '[vector data hidden]' })),
          skills: skillEmbeddings.map(e => ({ ...e, vector: '[vector data hidden]' }))
        }
      });

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
    let processed = 0;

    const results = await Promise.all(
      jobs.map(async job => {
        const result = await this.processJob(job);
        processed++;
        this.logger.info(`Batch progress: ${processed}/${jobs.length} (${Math.round((processed/jobs.length)*100)}%)`);
        return result;
      })
    );

    const succeeded = results.filter(r => r !== undefined).length;
    const failed = results.filter(r => r === undefined).length;
    this.logger.info(`Batch processing complete: ${succeeded} succeeded, ${failed} failed`);

    return results;
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