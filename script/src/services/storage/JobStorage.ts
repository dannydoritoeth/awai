/**
 * @file JobStorage.ts
 * @description Handles all job-related database operations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../utils/logger.js';
import { JobDetails, JobRecord, ProcessedJob, QueryOptions, EmbeddingRecord, CompanyRecord } from './types.js';
import { JobDocument } from '../spider/types.js';
import { CompanyStorage } from './CompanyStorage.js';
import { RoleStorage } from './RoleStorage.js';
import { CapabilityStorage } from './CapabilityStorage.js';
import { SkillStorage } from './SkillStorage.js';
import { DocumentService } from '../document/DocumentService.js';
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
   * Process job documents
   */
  private async processJobDocuments(jobId: string, documents: Array<{ url: string; title?: string; type: string; }>): Promise<{
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

      this.logger.info(`Processed documents: ${JSON.stringify(processedDocs)}`);
      
      // Use PostgreSQL pool if available, otherwise fall back to Supabase
      if (this.pgStagingPool) {
        this.logger.info(`Using PostgreSQL pool for job ${jobId} document storage`);
        const client = await this.pgStagingPool.connect();
        try {
          // First get the UUID for this job from the jobs table
          this.logger.info(`Looking up job UUID for ${jobId}`);
          const jobResult = await client.query(
            'SELECT id FROM jobs WHERE external_id = $1 OR original_id = $1',
            [jobId]
          );

          if (!jobResult.rows.length) {
            const error = new Error(`No job found with ID ${jobId}`);
            this.logger.error(`Job lookup failed:`, {
              jobId,
              error: error.message
            });
            throw error;
          }

          const jobUUID = jobResult.rows[0].id;
          this.logger.info(`Found job UUID:`, {
            jobId,
            jobUUID
          });
          
          // Store documents in the database
          for (const doc of processedDocs) {
            try {
              const documentId = crypto.randomUUID();
              this.logger.info(`Storing document for job ${jobId}:`, {
                jobUUID,
                documentId,
                url: doc.url,
                type: doc.type,
                title: doc.title,
                hasContent: !!doc.content,
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
                    content: doc.content,
                    lastModified: doc.lastModified,
                    parsedContent: doc.parsedContent || null
                  }
                ]
              );
              this.logger.info(`Successfully stored document:`, {
                jobId,
                documentId,
                url: doc.url
              });
            } catch (error) {
              this.logger.error(`Error storing document for job ${jobId}:`, {
                error: error,
                code: (error as any)?.code,
                message: (error as Error)?.message,
                constraint: (error as any)?.constraint,
                detail: (error as any)?.detail,
                url: doc.url
              });
            }
          }
        } catch (error) {
          this.logger.error(`Error in PostgreSQL document storage for job ${jobId}:`, {
            error: error,
            code: (error as any)?.code,
            message: (error as Error)?.message,
            stack: (error as Error)?.stack
          });
          throw error;
        } finally {
          client.release();
          this.logger.info(`Released PostgreSQL client for job ${jobId}`);
        }
      } else {
        // Fall back to Supabase client
        this.logger.info(`Using Supabase client for job ${jobId} document storage`);
        
        // First get the job ID
        this.logger.info(`Looking up job ID for ${jobId}`);
        let jobData = null;
        let jobError = null;
        try {
          jobData = await this.getJobByExternalId(jobId);
        } catch (error) {
          jobError = {
            code: (error as any)?.code,
            message: (error as Error)?.message,
            details: (error as any)?.details
          };
        }

        if (jobError) {
          this.logger.error(`Error looking up job in Supabase:`, {
            jobId,
            error: jobError,
            code: jobError.code,
            message: jobError.message,
            details: jobError.details
          });
          throw jobError;
        }

        if (!jobData) {
          const error = new Error(`No job found with ID ${jobId}`);
          this.logger.error(`Job lookup failed in Supabase:`, {
            jobId,
            error: error.message
          });
          throw error;
        }

        this.logger.info(`Found job in Supabase:`, {
          jobId,
          supabaseId: jobData.id
        });

        // Store documents using Supabase
        for (const doc of processedDocs) {
          try {
            const documentId = crypto.randomUUID();
            this.logger.info(`Storing document in Supabase for job ${jobId}:`, {
              jobId: jobData.id,
              documentId,
              url: doc.url,
              type: doc.type,
              title: doc.title,
              hasContent: !!doc.content,
              hasParsedContent: !!doc.parsedContent
            });

            const { error } = await this.stagingClient
              .from('job_documents')
              .insert({
                job_id: jobData.id,
                document_id: documentId,
                document_url: doc.url,
                document_type: doc.type,
                title: doc.title || '',
                url: doc.url,
                sync_status: 'pending',
                last_synced_at: null,
                raw_data: {
                  content: doc.content,
                  lastModified: doc.lastModified,
                  parsedContent: doc.parsedContent || null
                }
              });

            if (error) {
              this.logger.error(`Error storing document in Supabase:`, {
                jobId,
                documentId,
                url: doc.url,
                error: error,
                code: error.code,
                message: error.message,
                details: error.details
              });
            } else {
              this.logger.info(`Successfully stored document in Supabase:`, {
                jobId,
                documentId,
                url: doc.url
              });
            }
          } catch (error) {
            this.logger.error(`Error in Supabase document storage:`, {
              jobId,
              url: doc.url,
              error: error,
              code: (error as any)?.code,
              message: (error as Error)?.message,
              details: (error as any)?.details
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
   * Store a processed job and its related data
   */
  async storeJob(job: ProcessedJob): Promise<void> {
    try {
      const jobId = job.jobDetails.id;
      if (!jobId) throw new Error('Job ID is required');

      this.logger.info('Processing job:', {
        id: jobId,
        title: job.jobDetails.title,
        location: job.jobDetails.location,
        department: job.jobDetails.agency,
        documentsCount: job.jobDetails.documents?.length || 0
      });
      
      // Get or create company first
      this.logger.info(`Getting/creating company for job ${jobId}:`, {
        agency: job.jobDetails.agency || 'NSW Government'
      });
      const company = await this.getOrCreateCompany(job.jobDetails);
      this.logger.info(`Company found/created for job ${jobId}:`, {
        companyId: company.id,
        companyName: company.name
      });

      // Store the role
      this.logger.info(`Storing role for job ${jobId}:`, {
        title: job.jobDetails.title,
        companyId: company.id
      });
      const roleData = await this.roles.storeRoleRecord({
        title: job.jobDetails.title,
        company_id: company.id,
        raw_data: job.jobDetails
      });
      this.logger.info(`Role stored for job ${jobId}:`, {
        roleId: roleData[0]?.id,
        roleTitle: roleData[0]?.title
      });

      // Process any attached documents
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
        this.logger.info(`Processing ${job.jobDetails.documents.length} documents for job ${jobId}`);
        const documentUrls = job.jobDetails.documents.map((doc: JobDocument) => {
          const url = typeof doc.url === 'object' ? doc.url.url : doc.url;
          this.logger.info(`Processing document for job ${jobId}:`, {
            url,
            title: doc.title,
            type: doc.type || 'attachment'
          });
          return {
            url,
          title: doc.title,
          type: doc.type || 'attachment'
          };
        });

        const { documents, analysis } = await this.processJobDocuments(jobId, documentUrls);
        if (analysis) {
          documentAnalysis = analysis;
          this.logger.info(`Document analysis completed for job ${jobId}:`, {
            capabilitiesFound: analysis.capabilities.length,
            skillsFound: analysis.skills.length
          });
        }
      }

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
            role_id: roleData[0].id,
            locations: Array.isArray(job.jobDetails.location) ? job.jobDetails.location : [job.jobDetails.location],
            remuneration: job.jobDetails.salary,
            close_date: job.jobDetails.closingDate === 'Ongoing' ? null : job.jobDetails.closingDate,
            open_date: job.jobDetails.postedDate || new Date().toISOString(),
            job_type: job.jobDetails.jobType,
            source_url: job.jobDetails.url,
            raw_json: job.jobDetails,
            sync_status: 'pending',
            last_synced_at: null,
            raw_data: job.jobDetails
          };

          if (existingJobResult.rows.length > 0) {
            // Update existing job
            this.logger.info(`Updating existing job ${jobId}:`, {
              jobRecordId: existingJobResult.rows[0].id
            });
            await client.query(
              `UPDATE jobs 
              SET title = $1, role_id = $2, locations = $3, remuneration = $4, 
                  close_date = $5, open_date = $6, job_type = $7, source_url = $8,
                  raw_json = $9, sync_status = $10, last_synced_at = $11, raw_data = $12
              WHERE id = $13`,
              [
                jobRecord.title,
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
                existingJobResult.rows[0].id
              ]
            );
            this.logger.info(`Successfully updated job ${jobId}`);
          } else {
            // Insert new job
            this.logger.info(`Inserting new job ${jobId}`);
            await client.query(
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
            this.logger.info(`Successfully inserted job ${jobId}`);
          }

          await client.query('COMMIT');
          this.logger.info(`Committed transaction for job ${jobId}`);
        } catch (error) {
          await client.query('ROLLBACK');
          this.logger.error(`Rolled back transaction for job ${jobId}:`, error);
          throw error;
        } finally {
          client.release();
          this.logger.info(`Released client connection for job ${jobId}`);
        }
      } else {
        // Fall back to Supabase client
        this.logger.info(`Using Supabase client for job ${jobId} (PostgreSQL pool not available)`);

      // Check if job exists
      const { data: existingJob, error: checkError } = await this.stagingClient
        .from('jobs')
        .select('id')
        .eq('company_id', company.id)
        .eq('source_id', 'nswgov')
        .eq('external_id', jobId)
        .maybeSingle();

        if (checkError) {
          this.logger.error(`Error checking existing job ${jobId}:`, {
            error: checkError,
            code: checkError.code,
            details: checkError.details,
            hint: checkError.hint,
            message: checkError.message
          });
          if (checkError.code !== 'PGRST116') {
        throw checkError;
      }
        }

        this.logger.info(`Checked existing job ${jobId} with Supabase:`, {
          exists: !!existingJob,
          existingId: existingJob?.id
        });

      // Prepare job record
      const jobRecord = {
        external_id: jobId,
        source_id: 'nswgov',
        title: job.jobDetails.title,
        company_id: company.id,
        role_id: roleData[0].id,
        locations: Array.isArray(job.jobDetails.location) ? job.jobDetails.location : [job.jobDetails.location],
        remuneration: job.jobDetails.salary,
        close_date: job.jobDetails.closingDate === 'Ongoing' ? null : job.jobDetails.closingDate,
        open_date: job.jobDetails.postedDate || new Date().toISOString(),
        job_type: job.jobDetails.jobType,
        source_url: job.jobDetails.url,
        raw_json: job.jobDetails,
        sync_status: 'pending',
        last_synced_at: null,
        raw_data: job.jobDetails
      };

      if (existingJob) {
        // Update existing job
          this.logger.info(`Updating existing job ${jobId} with Supabase:`, {
            existingId: existingJob.id
          });
        const { error: updateError } = await this.stagingClient
          .from('jobs')
          .update(jobRecord)
          .eq('id', existingJob.id)
          .select()
          .single();

          if (updateError) {
            this.logger.error(`Error updating job ${jobId} with Supabase:`, {
              error: updateError,
              code: updateError.code,
              details: updateError.details,
              hint: updateError.hint,
              message: updateError.message
            });
            throw updateError;
          }
          this.logger.info(`Successfully updated job ${jobId} with Supabase`);
      } else {
        // Insert new job
          this.logger.info(`Inserting new job ${jobId} with Supabase`);
        const { error: insertError } = await this.stagingClient
          .from('jobs')
          .insert(jobRecord)
          .select()
          .single();

          if (insertError) {
            this.logger.error(`Error inserting job ${jobId} with Supabase:`, {
              error: insertError,
              code: insertError.code,
              details: insertError.details,
              hint: insertError.hint,
              message: insertError.message
            });
            throw insertError;
          }
          this.logger.info(`Successfully inserted job ${jobId} with Supabase`);
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

      this.logger.info(`Completed processing job ${jobId}`);
    } catch (error) {
      this.logger.error(`Error in storeJob for job ${job.jobDetails.id}:`, {
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
  private async getJobByExternalId(externalId: string): Promise<{ id: string } | null> {
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
      return job;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Error getting job by external ID ${externalId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
} 