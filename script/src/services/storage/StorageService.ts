/**
 * @file StorageService.ts
 * @description Part of NSW Government Jobs ETL Refactoring
 * 
 * Implementation of the storage service using Supabase.
 * This service maintains the same storage functionality as the current implementation
 * while improving error handling and data consistency.
 * 
 * @module services/storage
 * @see RefactorETL.md for the complete refactoring plan
 * 
 * @author AWAI Team
 * @version 1.0.0
 * @since 2024-02-06
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { chunk } from '../../utils/helpers.js';
import { Logger } from '../../utils/logger.js';
import {
  IStorageService,
  StorageConfig,
  StorageMetrics,
  StorageError,
  JobRecord,
  CapabilityRecord,
  EmbeddingRecord,
  TaxonomyRecord,
  QueryOptions
} from './types.js';
import { ProcessedJob } from '../processor/types.js';

export class StorageService implements IStorageService {
  private client: SupabaseClient;
  private metrics: StorageMetrics;

  constructor(
    private config: StorageConfig,
    private logger: Logger
  ) {
    try {
      this.logger.info('Creating Supabase client with config:', {
        url: config.supabaseUrl ? 'Set' : 'Not Set',
        key: config.supabaseKey ? 'Set' : 'Not Set'
      });
    this.client = createClient(config.supabaseUrl, config.supabaseKey);
    this.metrics = {
      totalStored: 0,
      successfulStores: 0,
      failedStores: 0,
      startTime: new Date(),
      errors: []
    };
    } catch (error) {
      this.logger.error('Failed to create Supabase client:', error);
      throw error;
    }
  }

  /**
   * Handle storage errors with detailed context
   */
  private handleStorageError(operation: StorageError['operation'], table: string, error: any, jobId?: string): void {
    const errorDetails: StorageError = {
      operation,
      table,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date(),
      jobId,
      context: {
        stack: error instanceof Error ? error.stack : undefined,
        cause: error instanceof Error ? error.cause : undefined
      }
    };

    this.metrics.errors.push(errorDetails);
    this.logger.error(`Storage error in ${operation} operation on ${table}:`, error);
  }

  /**
   * Get or create the NSW Government institution
   */
  private async getOrCreateInstitution(): Promise<string> {
    try {
      const slug = 'nsw-gov';
      this.logger.info('Looking up institution with slug:', slug);
      
      const { data: institution, error: fetchError } = await this.client
        .from('institutions')
        .select('id')
        .eq('slug', slug)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') { // Not found error
          this.logger.info('Institution not found, creating new one');
          const { data: newInstitution, error: insertError } = await this.client
            .from('institutions')
            .insert({
              name: 'NSW Government',
              slug: slug,
              description: 'New South Wales Government Departments and Agencies',
              website_url: 'https://www.nsw.gov.au'
            })
            .select()
            .single();

          if (insertError) {
            this.logger.error('Failed to create institution:', insertError);
            throw insertError;
          }

          return newInstitution.id;
        } else {
          this.logger.error('Error fetching institution:', fetchError);
          throw fetchError;
        }
      }

      if (institution) {
        this.logger.info('Found existing institution:', institution.id);
        return institution.id;
      }

      throw new Error('No institution found or created');
    } catch (error) {
      this.logger.error('Error in getOrCreateInstitution:', error);
      throw error;
    }
  }

  /**
   * Initialize and test Supabase connection
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Testing Supabase connection...');
      
      // First test a simple query
      this.logger.info('Testing simple query...');
      const { data, error } = await this.client.from('jobs').select('id').limit(1);
      
      if (error) {
        this.logger.error('Database query failed:', error);
        if ('code' in error) {
          this.logger.error('Error code:', (error as any).code);
        }
        if ('details' in error) {
          this.logger.error('Error details:', (error as any).details);
        }
        if ('hint' in error) {
          this.logger.error('Error hint:', (error as any).hint);
        }
        if ('message' in error) {
          this.logger.error('Error message:', (error as any).message);
        }
        throw error;
      }

      this.logger.info('Database query successful');

      // Try to get or create institution
      this.logger.info('Setting up institution...');
      const institutionId = await this.getOrCreateInstitution();
      this.config.institutionId = institutionId;
      this.logger.info('Using institution ID:', institutionId);

      this.logger.info('Initialization completed successfully');
    } catch (error) {
      this.logger.error('Initialization failed:', error);
      if (error instanceof Error) {
        this.logger.error('Error stack:', error.stack);
      }
      throw error;
    }
  }

  /**
   * Store a processed job and its related data
   */
  async storeJob(job: ProcessedJob): Promise<void> {
    try {
      // Validate job ID
      const jobId = job.jobDetails.id;
      if (!jobId) {
        throw new Error('Job ID is required but was null or undefined');
      }

      this.logger.info(`Starting storage for job ${jobId}`);
      
      try {
        // Store job details
        this.logger.info(`Storing job details for ${jobId}`);
        await this.storeJobRecord(job);
        this.logger.info(`Successfully stored job details for ${jobId}`);

        // Store capabilities
        this.logger.info(`Storing ${job.capabilities.capabilities.length} capabilities for job ${jobId}`);
        await this.storeCapabilityRecords(job);
        this.logger.info(`Successfully stored capabilities for job ${jobId}`);

        // Store embeddings
        this.logger.info(`Storing embeddings for job ${jobId}`);
        await this.storeEmbeddingRecords(job);
        this.logger.info(`Successfully stored embeddings for job ${jobId}`);

        // Store taxonomy
        this.logger.info(`Storing taxonomy for job ${jobId}`);
        await this.storeTaxonomyRecord(job);
        this.logger.info(`Successfully stored taxonomy for job ${jobId}`);

        this.metrics.successfulStores++;
        this.metrics.totalStored++;

      } catch (error) {
        this.logger.error(`Error in storage for job ${jobId}:`, error);
        throw error;
      }

    } catch (error) {
      this.metrics.failedStores++;
      this.handleStorageError('insert', 'multiple', error, job?.jobDetails?.id);
      throw error;
    }
  }

  /**
   * Store a batch of processed jobs
   */
  async storeBatch(jobs: ProcessedJob[]): Promise<void> {
    this.logger.info(`Starting batch storage of ${jobs.length} jobs`);
    
    const batches = chunk(jobs, this.config.batchSize);
    let currentBatch = 0;
    
    for (const batch of batches) {
      currentBatch++;
      this.logger.info(`Processing batch ${currentBatch}/${batches.length}`);
      
      const results = await Promise.allSettled(
        batch.map(job => this.storeJob(job))
      );

      // Log batch results
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      this.logger.info(`Batch ${currentBatch} complete: ${succeeded} succeeded, ${failed} failed`);
    }

    this.logger.info(`Batch storage complete: ${this.metrics.successfulStores} total succeeded, ${this.metrics.failedStores} total failed`);
  }

  /**
   * Get a job record by ID
   */
  async getJobById(id: string): Promise<JobRecord | null> {
    try {
      const { data, error } = await this.client
        .from(this.config.jobsTable)
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      this.handleStorageError('query', this.config.jobsTable, error);
      return null;
    }
  }

  /**
   * Get job records by filter criteria
   */
  async getJobsByFilter(filters: Record<string, any>, options?: QueryOptions): Promise<JobRecord[]> {
    try {
      let query = this.client
        .from(this.config.jobsTable)
        .select('*');

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      // Apply options
      if (options?.limit) query = query.limit(options.limit);
      if (options?.offset) query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      if (options?.orderBy) {
        query = query.order(options.orderBy, {
          ascending: options.orderDirection === 'asc'
        });
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];

    } catch (error) {
      this.handleStorageError('query', this.config.jobsTable, error);
      return [];
    }
  }

  /**
   * Get capability records for a job
   */
  async getCapabilitiesByJobId(jobId: string): Promise<CapabilityRecord[]> {
    try {
      const { data, error } = await this.client
        .from(this.config.capabilitiesTable)
        .select('*')
        .eq('jobId', jobId);

      if (error) throw error;
      return data || [];

    } catch (error) {
      this.handleStorageError('query', this.config.capabilitiesTable, error);
      return [];
    }
  }

  /**
   * Get embedding records for a job
   */
  async getEmbeddingsByJobId(jobId: string): Promise<EmbeddingRecord[]> {
    try {
      const { data, error } = await this.client
        .from(this.config.embeddingsTable)
        .select('*')
        .eq('jobId', jobId);

      if (error) throw error;
      return data || [];

    } catch (error) {
      this.handleStorageError('query', this.config.embeddingsTable, error);
      return [];
    }
  }

  /**
   * Get taxonomy record for a job
   */
  async getTaxonomyByJobId(jobId: string): Promise<TaxonomyRecord | null> {
    try {
      const { data, error } = await this.client
        .from(this.config.taxonomyTable)
        .select('*')
        .eq('jobId', jobId)
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      this.handleStorageError('query', this.config.taxonomyTable, error);
      return null;
    }
  }

  /**
   * Get current storage metrics
   */
  getMetrics(): StorageMetrics {
    return {
      ...this.metrics,
      endTime: new Date()
    };
  }

  /**
   * Store job record
   */
  private async storeJobRecord(job: ProcessedJob): Promise<void> {
    try {
      this.logger.info('Creating job record with data:', {
        id: job.jobDetails.id,
        title: job.jobDetails.title,
        location: job.jobDetails.location,
        department: job.jobDetails.agency
      });

      const jobRecord = {
        title: job.jobDetails.title,
        source_id: 'nswgov',
        original_id: job.jobDetails.id,
        source_url: job.jobDetails.url,
        department: job.jobDetails.agency,
        locations: [job.jobDetails.location].filter(Boolean),
        close_date: job.jobDetails.closingDate ? new Date(job.jobDetails.closingDate) : null,
        remuneration: job.jobDetails.salary || 'Not specified',
        raw_json: job.jobDetails,
        first_seen_at: new Date(),
        last_updated_at: new Date(),
        raw_data: job.jobDetails,
        version: 1,
        sync_status: 'pending',
        last_synced_at: new Date()
      };

      // First check if the job exists
      const { data: existingJob, error: fetchError } = await this.client
        .from(this.config.jobsTable)
        .select()
        .eq('source_id', 'nswgov')
        .eq('original_id', job.jobDetails.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        this.logger.error('Error fetching existing job:', fetchError);
        throw fetchError;
      }

      let result;
      if (existingJob) {
        // Update existing job
        const { data, error: updateError } = await this.client
          .from(this.config.jobsTable)
          .update(jobRecord)
          .eq('id', existingJob.id)
          .select();

        if (updateError) {
          this.logger.error('Error updating job record:', updateError);
          throw updateError;
        }
        result = data;
        this.logger.info(`Successfully updated job ${job.jobDetails.id}`);
      } else {
        // Insert new job
        const { data, error: insertError } = await this.client
          .from(this.config.jobsTable)
          .insert(jobRecord)
          .select();

        if (insertError) {
          this.logger.error('Error inserting job record:', insertError);
          throw insertError;
        }
        result = data;
        this.logger.info(`Successfully inserted job ${job.jobDetails.id}`);
      }

      this.logger.info('Successfully stored job record:', result);
    } catch (error) {
      this.logger.error('Error in storeJobRecord:', error);
      this.handleStorageError('insert', this.config.jobsTable, error, job.jobDetails.id);
      throw error;
    }
  }

  /**
   * Store capability records
   */
  private async storeCapabilityRecords(job: ProcessedJob): Promise<void> {
    const capabilityRecords = job.capabilities.capabilities.map(cap => ({
      institution_id: this.config.institutionId,
      source_id: 'nswgov',
      external_id: `cap_${cap.name.toLowerCase().replace(/\s+/g, '_')}`,
      name: cap.name,
      level: cap.level,
      description: cap.description,
      relevance: cap.relevance,
      occupationalGroup: job.capabilities.occupationalGroups[0] || '',
      focusArea: job.capabilities.focusAreas[0] || '',
      source_framework: 'NSW Government Capability Framework',
      is_occupation_specific: false,
      raw_data: cap,
      processed: false,
      processing_status: 'pending',
      processedAt: job.metadata.processedAt
    }));

    if (capabilityRecords.length === 0) {
      this.logger.info(`No capabilities to store for job ${job.jobDetails.id}`);
      return;
    }

    const { error } = await this.client
      .from(this.config.capabilitiesTable)
      .upsert(capabilityRecords, {
        onConflict: 'institution_id,source_id,external_id'
      });

    if (error) throw error;
  }

  /**
   * Store embedding records
   */
  private async storeEmbeddingRecords(job: ProcessedJob): Promise<void> {
    const embeddings = [
      {
        institution_id: this.config.institutionId,
        source_id: 'nswgov',
        external_id: `emb_job_${job.jobDetails.id}`,
        jobId: job.jobDetails.id,
        type: 'job',
        vector: job.embeddings.job.vector,
        text: job.embeddings.job.text,
        metadata: job.embeddings.job.metadata,
        raw_data: job.embeddings.job,
        processed: false,
        processing_status: 'pending',
        processedAt: job.metadata.processedAt
      },
      ...job.embeddings.capabilities.map((emb, i) => ({
        institution_id: this.config.institutionId,
        source_id: 'nswgov',
        external_id: `emb_cap_${job.jobDetails.id}_${i}`,
        jobId: job.jobDetails.id,
        type: 'capability',
        vector: emb.vector,
        text: emb.text,
        metadata: emb.metadata,
        raw_data: emb,
        processed: false,
        processing_status: 'pending',
        index: i,
        processedAt: job.metadata.processedAt
      })),
      ...job.embeddings.skills.map((emb, i) => ({
        institution_id: this.config.institutionId,
        source_id: 'nswgov',
        external_id: `emb_skill_${job.jobDetails.id}_${i}`,
        jobId: job.jobDetails.id,
        type: 'skill',
        vector: emb.vector,
        text: emb.text,
        metadata: emb.metadata,
        raw_data: emb,
        processed: false,
        processing_status: 'pending',
        index: i,
        processedAt: job.metadata.processedAt
      }))
    ];

    const { error } = await this.client
      .from(this.config.embeddingsTable)
      .upsert(embeddings, {
        onConflict: 'institution_id,source_id,external_id'
      });

    if (error) throw error;
  }

  /**
   * Store taxonomy record
   */
  private async storeTaxonomyRecord(job: ProcessedJob): Promise<void> {
    const taxonomyRecord = {
      institution_id: this.config.institutionId,
      source_id: 'nswgov',
      external_id: `taxonomy_${job.jobDetails.id}`,
      jobId: job.jobDetails.id,
      type: 'job',
      vector: job.taxonomy.vector,
      text: job.taxonomy.text,
      metadata: job.taxonomy.metadata,
      raw_data: job.taxonomy,
      processed: false,
      processing_status: 'pending',
      processedAt: job.metadata.processedAt
    };

    this.logger.info('Upserting taxonomy record to database:', taxonomyRecord);
    const { data, error } = await this.client
      .from(this.config.taxonomyTable)
      .upsert(taxonomyRecord, {
        onConflict: 'institution_id,source_id,external_id'
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Error upserting taxonomy record:', error);
      this.handleStorageError('insert', this.config.taxonomyTable, error, job.jobDetails.id);
      throw error;
    }

    this.logger.info('Successfully stored taxonomy record:', data);
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      // Close Supabase client
      await this.client.auth.signOut();
      this.logger.info('Successfully cleaned up storage service');
    } catch (error) {
      this.logger.error('Error cleaning up storage service:', error);
    }
  }
} 