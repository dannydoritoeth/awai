/**
 * @file JobStorage.ts
 * @description Handles all job-related database operations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../utils/logger.js';
import { JobDetails, JobRecord, ProcessedJob, QueryOptions, EmbeddingRecord, CompanyRecord } from './types.js';
import { JobDocument as SpiderJobDocument } from '../spider/types.js';
import { CompanyStorage } from './CompanyStorage.js';
import { RoleStorage } from './RoleStorage.js';
import { CapabilityStorage } from './CapabilityStorage.js';
import { SkillStorage } from './SkillStorage.js';
import { DocumentService } from '../document/DocumentService.js';
import { JobDocument } from '../../models/job.js';
import crypto from 'crypto';
import { Pool } from 'pg';

export class JobStorage {
  private skills: SkillStorage;
  private companies: CompanyStorage;
  private roles: RoleStorage;
  private capabilities: CapabilityStorage;
  private documentService: DocumentService;

  constructor(
    private stagingClient: SupabaseClient,
    private liveClient: SupabaseClient,
    private logger: Logger,
    private pgStagingPool?: Pool
  ) {
    this.companies = new CompanyStorage(stagingClient, liveClient, logger, pgStagingPool);
    this.skills = new SkillStorage(stagingClient, liveClient, logger, this.companies);
    this.roles = new RoleStorage(stagingClient, liveClient, logger, this.companies);
    this.capabilities = new CapabilityStorage(stagingClient, liveClient, logger, this.companies);
    this.documentService = new DocumentService(logger);
  }

  /**
   * Store a single job document in the database
   */
  private async storeJobDocument(jobUUID: string, doc: JobDocument): Promise<void> {
    if (!this.pgStagingPool) {
      throw new Error('PostgreSQL pool is required');
    }

    const client = await this.pgStagingPool.connect();
    try {
      const documentId = crypto.randomUUID();
      this.logger.info(`Storing document for job:`, {
        jobUUID,
        documentId,
        url: doc.url,
        type: doc.type,
        title: doc.title,
        hasParsedContent: !!doc.parsedContent
      });

      await client.query(
        `INSERT INTO job_documents (
          job_id,
          document_id,
          document_url,
          document_type,
          title,
          url,
          sync_status,
          last_synced_at,
          raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          jobUUID,
          documentId,
          doc.url,
          doc.type,
          doc.title || '',
          doc.url,
          'pending',
          null,
          {
            lastModified: doc.lastModified,
            parsedContent: doc.parsedContent || null
          }
        ]
      );
      
      this.logger.info(`Successfully stored document:`, {
        jobUUID,
        documentId,
        url: doc.url
      });
    } catch (error) {
      this.logger.error(`Error storing document:`, {
        error: error,
        code: (error as any)?.code,
        message: (error as Error)?.message,
        constraint: (error as any)?.constraint,
        detail: (error as any)?.detail,
        url: doc.url
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process job documents
   */
  private async processJobDocuments(jobId: string, documents: Array<{ url: string; title?: string; type: string; }>, skipStorage: boolean = false): Promise<{
    documents: Array<{ url: string; title?: string; type: string; }>;
    analysis?: {
      capabilities: any[];
      skills: any[];
    };
  }> {
    try {
      this.logger.info(`Starting document processing for job ${jobId}:`, {
        documentCount: documents.length,
        documents: documents.map(d => ({
          url: d.url,
          title: d.title,
          type: d.type
        }))
      });

      // Download and process all documents first
      const processedDocs = await this.documentService.processDocuments(documents);
      this.logger.info(`Documents processed for job ${jobId}:`, {
        processedCount: processedDocs.length,
        successfulUrls: processedDocs.map(d => d.url)
      });
      
      // Only store documents if not skipping storage
      if (!skipStorage) {
        // Get job UUID for document storage
        const jobUUID = await this.getJobByExternalId(jobId);
        
        if (!jobUUID) {
          throw new Error(`No job found with ID ${jobId}`);
        }

        // Store each processed document
        for (const doc of processedDocs) {
          try {
            await this.storeJobDocument(jobUUID, doc);
          } catch (error) {
            this.logger.error(`Failed to store document for job ${jobId}:`, {
              error: error,
              url: doc.url
            });
          }
        }
      }

      this.logger.info(`Completed document processing for job ${jobId}:`, {
        totalDocuments: documents.length,
        processedDocuments: processedDocs.length,
        successfulUrls: processedDocs.map(d => d.url)
      });

      return {
        documents: processedDocs.map(doc => ({
          url: doc.url,
          title: doc.title,
          type: doc.type
        }))
      };
    } catch (error) {
      this.logger.error(`Error in document processing for job ${jobId}:`, {
        error: error,
        code: (error as any)?.code,
        message: (error as Error)?.message,
        stack: (error as Error)?.stack,
        documentCount: documents.length
      });
      return {
        documents: []
      };
    }
  }

  /**
   * Get or create a company record
   */
  private async getOrCreateCompany(job: JobDetails): Promise<CompanyRecord> {
    return await this.companies.getOrCreateCompany({
      name: job.agency || 'NSW Government',
      description: job.aboutUs || '',
      website: '',
      raw_data: job
    });
  }

  /**
   * Store just the raw job and its documents
   */
  async storeRaw(job: ProcessedJob): Promise<void> {
    const jobId = job.jobDetails.id;

    const jobUUID = await this.getJobByExternalId(jobId);
    if (jobUUID) {
      this.logger.info(`Job already exists with ID ${jobUUID}, skipping storage`);
      return;
    }

    try {
      if (!jobId) throw new Error('Job ID is required');
      this.logger.info(`Starting raw storage for job ${jobId}`);

      // Get or create company first
      const company = await this.getOrCreateCompany(job.jobDetails);
      
      // Use PostgreSQL pool if available
      if (this.pgStagingPool) {
        this.logger.info(`Using PostgreSQL pool for job ${jobId}`);
        const client = await this.pgStagingPool.connect();
        try {
          await client.query('BEGIN');
          this.logger.info(`Started transaction for job ${jobId}`);

          // Check if job exists
          const existingJobResult = await client.query(
            'SELECT id FROM jobs WHERE company_id = $1 AND source_id = $2 AND external_id = $3 FOR UPDATE',
            [company.id, 'nswgov', jobId]
          );
          this.logger.info(`Checked existing job ${jobId}:`, {
            exists: existingJobResult.rows.length > 0,
            companyId: company.id,
            sourceId: 'nswgov'
          });

          // Prepare job record
          const jobRecord = {
            external_id: jobId,
            source_id: 'nswgov',
            title: job.jobDetails.title,
            company_id: company.id,
            role_id: job.jobDetails.roleId,
            locations: Array.isArray(job.jobDetails.location) ? job.jobDetails.location : [job.jobDetails.location],
            remuneration: job.jobDetails.salary || '',
            close_date: job.jobDetails.closingDate === 'Ongoing' ? null : job.jobDetails.closingDate,
            open_date: job.jobDetails.postedDate || new Date().toISOString(),
            job_type: job.jobDetails.jobType || '',
            source_url: job.jobDetails.url || '',
            raw_json: job.jobDetails,
            sync_status: 'pending',
            last_synced_at: null,
            raw_data: job.jobDetails
          };

          let jobUUID: string;
          if (existingJobResult.rows.length > 0) {
            // Update existing job
            jobUUID = existingJobResult.rows[0].id;
            this.logger.info(`Updating existing job ${jobId}:`, {
              jobRecordId: jobUUID
            });
            await client.query(
              `UPDATE jobs 
              SET title = $1, company_id = $2, role_id = $3, locations = $4,
                  remuneration = $5, close_date = $6, open_date = $7, job_type = $8,
                  source_url = $9, raw_json = $10, sync_status = $11, last_synced_at = $12,
                  raw_data = $13
              WHERE id = $14`,
              [
                jobRecord.title,
                jobRecord.company_id,
                jobRecord.role_id,
                jobRecord.locations,
                jobRecord.remuneration,
                jobRecord.close_date,
                jobRecord.open_date,
                jobRecord.job_type,
                jobRecord.source_url,
                jobRecord.raw_json,
                jobRecord.sync_status,
                jobRecord.last_synced_at,
                jobRecord.raw_data,
                jobUUID
              ]
            );
            this.logger.info(`Successfully updated job ${jobId}`);
          } else {
            // Insert new job
            this.logger.info(`Inserting new job ${jobId}`);
            const insertResult = await client.query(
              `INSERT INTO jobs 
              (external_id, source_id, title, company_id, role_id, locations, 
               remuneration, close_date, open_date, job_type, source_url, 
               raw_json, sync_status, last_synced_at, raw_data)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
              RETURNING id`,
              [
                jobRecord.external_id,
                jobRecord.source_id,
                jobRecord.title,
                jobRecord.company_id,
                jobRecord.role_id,
                jobRecord.locations,
                jobRecord.remuneration,
                jobRecord.close_date,
                jobRecord.open_date,
                jobRecord.job_type,
                jobRecord.source_url,
                jobRecord.raw_json,
                jobRecord.sync_status,
                jobRecord.last_synced_at,
                jobRecord.raw_data
              ]
            );
            jobUUID = insertResult.rows[0].id;
            this.logger.info(`Successfully inserted job ${jobId}`);
          }

          await client.query('COMMIT');
          this.logger.info(`Committed transaction for job ${jobId}`);

          // Process documents if any exist
          if (job.jobDetails.documents?.length) {
            const documentUrls = job.jobDetails.documents.map((doc: SpiderJobDocument) => {
              const url = typeof doc.url === 'object' ? doc.url.url : doc.url;
              return {
                url,
                title: doc.title,
                type: doc.type || 'attachment'
              };
            });

            // Download and process all documents
            const processedDocs = await this.documentService.processDocuments(documentUrls);
            
            // Store each processed document
            for (const doc of processedDocs) {
              try {
                await this.storeJobDocument(jobUUID, doc);
              } catch (error) {
                this.logger.error(`Failed to store document for job ${jobId}:`, {
                  error: error,
                  url: doc.url
                });
              }
            }

            this.logger.info(`Completed document processing for job ${jobId}:`, {
              totalDocuments: documentUrls.length,
              processedDocuments: processedDocs.length,
              successfulUrls: processedDocs.map(d => d.url)
            });
          }

          this.logger.info(`Completed raw storage for job ${jobId}`);
        } catch (error) {
          await client.query('ROLLBACK');
          this.logger.error(`Rolled back transaction for job ${jobId}:`, error);
          throw error;
        } finally {
          client.release();
          this.logger.info(`Released client connection for job ${jobId}`);
        }
      } else {
        throw new Error('PostgreSQL pool not available');
      }
    } catch (error) {
      this.logger.error(`Error in storeRaw for job ${jobId}:`, {
        error,
        code: (error as any)?.code,
        details: (error as any)?.details,
        hint: (error as any)?.hint,
        message: (error as any)?.message,
        stack: (error as Error)?.stack
      });
      throw error;
    }
  }

  /**
   * Store a job with full processing (documents, capabilities, skills)
   */
  async storeAll(job: ProcessedJob): Promise<void> {
    const jobId = job.jobDetails.id;
    try {
      this.logger.info(`Starting full storage for job ${jobId}`);

      // First store the raw job and documents
      await this.storeRaw(job);

      // Analyze documents for capabilities/skills if any exist
      let documentAnalysis: {
        capabilities: Array<{
          id?: string;
          name: string;
          level: string;
          description: string;
          behavioral_indicators: string[];
        }>;
        skills: Array<{
          name: string;
          description?: string;
          category?: string;
          text?: string;
        }>;
      } = {
        capabilities: [],
        skills: []
      };

      if (job.jobDetails.documents?.length) {
        this.logger.info(`Analyzing ${job.jobDetails.documents.length} documents for job ${jobId}`);
        const documentUrls = job.jobDetails.documents.map((doc: SpiderJobDocument) => {
          const url = typeof doc.url === 'object' ? doc.url.url : doc.url;
          return {
            url,
            title: doc.title,
            type: doc.type || 'attachment'
          };
        });

        // Process documents for analysis only, don't store them again
        const { analysis } = await this.processJobDocuments(jobId, documentUrls, true);
        if (analysis) {
          documentAnalysis = analysis;
          this.logger.info(`Document analysis completed for job ${jobId}:`, {
            capabilitiesFound: analysis.capabilities.length,
            skillsFound: analysis.skills.length
          });
        }
      }

      // Store capabilities and skills from both job and documents
      const allCapabilities = [
        ...(job.capabilities?.capabilities || []).map(cap => ({
          ...cap,
          behavioral_indicators: []
        })),
        ...documentAnalysis.capabilities
      ];

      const allSkills = [
        ...(job.capabilities?.skills || []),
        ...documentAnalysis.skills,
        ...(job.taxonomy?.technicalSkills || []).map((skill: string) => ({
          name: skill,
          description: skill,
          category: 'Technical' as const
        })),
        ...(job.taxonomy?.softSkills || []).map((skill: string) => ({
          name: skill,
          description: skill,
          category: 'Soft Skills' as const
        }))
      ];

      this.logger.info(`Storing capabilities and skills for job ${jobId}:`, {
        capabilitiesCount: allCapabilities.length,
        skillsCount: allSkills.length
      });

      await this.capabilities.storeCapabilityRecords(job, allCapabilities);
      await this.skills.storeSkillRecords(job, allSkills);

      this.logger.info(`Completed full storage for job ${jobId}`);
    } catch (error) {
      this.logger.error(`Error in storeAll for job ${jobId}:`, {
        error,
        code: (error as any)?.code,
        details: (error as any)?.details,
        hint: (error as any)?.hint,
        message: (error as any)?.message,
        stack: (error as Error)?.stack
      });
      throw error;
    }
  }

  /**
   * Store a job (alias for storeAll for backward compatibility)
   */
  async storeJob(job: ProcessedJob): Promise<void> {
    return this.storeAll(job);
  }

  /**
   * Store a batch of processed jobs
   */
  async storeBatch(jobs: ProcessedJob[]): Promise<void> {
    try {
      this.logger.info(`Storing batch of ${jobs.length} jobs`);
      const processedDocs: ProcessedJob[] = [];

      for (const job of jobs) {
        try {
          await this.storeJob(job);
          processedDocs.push(job);
        } catch (error) {
          this.logger.error(`Error storing job ${job.jobDetails.id}:`, error);
        }
      }

      this.logger.info(`Successfully processed ${processedDocs.length} out of ${jobs.length} jobs`);
    } catch (error) {
      this.logger.error('Error in storeBatch:', error);
      throw error;
    }
  }

  /**
   * Get a job record by ID
   */
  async getJobById(id: string): Promise<JobRecord | null> {
    try {
      const { data, error } = await this.liveClient
        .from('jobs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      this.logger.error('Error in getJobById:', error);
      return null;
    }
  }

  /**
   * Get job records by filter criteria
   */
  async getJobsByFilter(filters: Record<string, any>, options?: QueryOptions): Promise<JobRecord[]> {
    try {
      let query = this.liveClient
        .from('jobs')
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
      this.logger.error('Error in getJobsByFilter:', error);
      return [];
    }
  }

  /**
   * Check if a job already exists and is synced
   */
  async checkExistingSyncedJob(jobId: string): Promise<{ exists: boolean; id?: string; title?: string }> {
    try {
      const { data, error } = await this.stagingClient
        .from('jobs')
        .select('id, title')
        .eq('external_id', jobId)
        .eq('source_id', 'nswgov')
        .eq('sync_status', 'synced')
        .maybeSingle();

      if (error) {
        this.logger.error(`Error checking for existing job ${jobId}:`, error);
        throw error;
      }

      return {
        exists: !!data,
        id: data?.id,
        title: data?.title
      };
    } catch (error) {
      this.logger.error('Error in checkExistingSyncedJob:', error);
      throw error;
    }
  }

  /**
   * Get embeddings for a job by ID
   */
  async getEmbeddingsByJobId(jobId: string): Promise<EmbeddingRecord[]> {
    try {
      const { data, error } = await this.liveClient
        .from('embeddings')
        .select('*')
        .eq('jobId', jobId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      this.logger.error('Error in getEmbeddingsByJobId:', error);
      return [];
    }
  }

  /**
   * Get a job by its external ID
   */
  private async getJobByExternalId(externalId: string): Promise<string | null> {
    if (!this.pgStagingPool) {
      throw new Error('PostgreSQL pool is required');
    }

    const client = await this.pgStagingPool.connect();
    try {
      await client.query('BEGIN');

      // Look up job - use FOR UPDATE to lock the row
      const existingJobResult = await client.query(
        'SELECT id FROM jobs WHERE external_id = $1 OR original_id = $1 FOR UPDATE',
        [externalId]
      );

      await client.query('COMMIT');
      
      if (existingJobResult.rows.length === 0) {
        return null;
      }

      const job = existingJobResult.rows[0];
      this.logger.info(`Found job with external ID ${externalId}:`, {
        id: job.id
      });
      return job.id;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Error getting job by external ID ${externalId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
} 