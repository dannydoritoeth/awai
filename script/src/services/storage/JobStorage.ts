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

export class JobStorage {
  private skills: SkillStorage;
  private companies: CompanyStorage;
  private roles: RoleStorage;
  private capabilities: CapabilityStorage;

  constructor(
    private stagingClient: SupabaseClient,
    private liveClient: SupabaseClient,
    private logger: Logger
  ) {
    this.companies = new CompanyStorage(stagingClient, liveClient, logger);
    this.skills = new SkillStorage(stagingClient, liveClient, logger, this.companies);
    this.roles = new RoleStorage(stagingClient, liveClient, logger, this.companies);
    this.capabilities = new CapabilityStorage(stagingClient, liveClient, logger);
  }

  /**
   * Process job documents
   */
  private async processJobDocuments(jobId: string, documents: Array<{ url: string; title: string; type: string; }>): Promise<{
    documents: Array<{ url: string; title: string; type: string; }>;
    analysis?: {
      capabilities: any[];
      skills: any[];
    };
  }> {
    try {
      const processedDocs: Array<{ url: string; title: string; type: string; }> = [];
      
      // Process each document
      for (const doc of documents) {
        try {
          processedDocs.push({
            url: doc.url,
            title: doc.title,
            type: doc.type
          });
        } catch (error) {
          this.logger.error(`Error processing document for job ${jobId}:`, error);
        }
      }

      return {
        documents: processedDocs
      };
    } catch (error) {
      this.logger.error(`Error processing documents for job ${jobId}:`, error);
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
        department: job.jobDetails.agency
      });
      
      // Get or create company first
      const company = await this.getOrCreateCompany(job.jobDetails);

      // Store the role
      const roleData = await this.roles.storeRoleRecord({
        title: job.jobDetails.title,
        company_id: company.id,
        raw_data: job.jobDetails
      });

      // Process any attached documents
      let documentAnalysis = {
        capabilities: [],
        skills: []
      };

      if (job.jobDetails.documents?.length) {
        const documentUrls = job.jobDetails.documents.map((doc: JobDocument) => ({
          url: typeof doc.url === 'object' ? doc.url.url : doc.url,
          title: doc.title,
          type: doc.type || 'attachment'
        }));
        const { documents, analysis } = await this.processJobDocuments(jobId, documentUrls);
        if (analysis) {
          documentAnalysis = analysis;
        }
      }

      // Check if job exists
      const { data: existingJob, error: checkError } = await this.stagingClient
        .from('jobs')
        .select('id')
        .eq('company_id', company.id)
        .eq('source_id', 'nswgov')
        .eq('external_id', jobId)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

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

      let result;
      if (existingJob) {
        // Update existing job
        const { error: updateError } = await this.stagingClient
          .from('jobs')
          .update(jobRecord)
          .eq('id', existingJob.id)
          .select()
          .single();

        if (updateError) throw updateError;
        this.logger.info(`Successfully updated job ${jobId}`);
      } else {
        // Insert new job
        const { error: insertError } = await this.stagingClient
          .from('jobs')
          .insert(jobRecord)
          .select()
          .single();

        if (insertError) throw insertError;
        this.logger.info(`Successfully inserted job ${jobId}`);
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

      this.logger.info(`Storing ${allCapabilities.length} capabilities and ${allSkills.length} skills for job ${jobId}`);

      await this.capabilities.storeCapabilityRecords(job, allCapabilities);
      await this.skills.storeSkillRecords(job, allSkills);

    } catch (error) {
      this.logger.error('Error in storeJob:', error);
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
} 