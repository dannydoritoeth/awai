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
  QueryOptions,
  JobDetails,
  JobDocument
} from './types.js';
import { ProcessedJob } from '../processor/types.js';
import { EmbeddingResult } from '../embeddings/templates/embeddingTemplates.js';
import path from 'path';
import fs from 'fs';
import PDFParser from 'pdf2json';
import mammoth from 'mammoth';
import os from 'os';

interface Capability {
  id: string;
  name: string;
  level: 'foundational' | 'intermediate' | 'adept' | 'advanced' | 'highly advanced';
  description: string;
  relevance: number;
  behavioral_indicators?: string[];
}

interface Skill {
  name: string;
  description: string;
  category: 'Technical' | 'Domain Knowledge' | 'Soft Skills';
  relevance?: number;
  text?: string;
}

interface DocumentAnalysis {
  capabilities: Capability[];
  skills: Skill[];
}

export class StorageService implements IStorageService {
  private liveClient: SupabaseClient;
  private stagingClient: SupabaseClient;
  private metrics: StorageMetrics;
  private combinedAnalysis: DocumentAnalysis = {
    capabilities: [],
    skills: []
  };

  constructor(
    private config: StorageConfig,
    private logger: Logger
  ) {
    try {
      // Validate required configuration
      if (!config.stagingSupabaseUrl) {
        throw new Error('stagingSupabaseUrl is required');
      }
      if (!config.stagingSupabaseKey) {
        throw new Error('stagingSupabaseKey is required');
      }
      if (!config.liveSupabaseUrl) {
        throw new Error('liveSupabaseUrl is required');
      }
      if (!config.liveSupabaseKey) {
        throw new Error('liveSupabaseKey is required');
      }

      this.logger.info('Creating Supabase clients with config:', {
        liveUrl: config.liveSupabaseUrl ? 'Set' : 'Not Set',
        liveKey: config.liveSupabaseKey ? 'Set' : 'Not Set',
        stagingUrl: config.stagingSupabaseUrl ? 'Set' : 'Not Set',
        stagingKey: config.stagingSupabaseKey ? 'Set' : 'Not Set'
      });
      
      this.liveClient = createClient(config.liveSupabaseUrl, config.liveSupabaseKey);
      this.stagingClient = createClient(config.stagingSupabaseUrl, config.stagingSupabaseKey);
      
    this.metrics = {
      totalStored: 0,
      successfulStores: 0,
      failedStores: 0,
      startTime: new Date(),
      errors: []
    };
    } catch (error) {
      this.logger.error('Failed to create Supabase clients:', error);
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
      
      const { data: institution, error: fetchError } = await this.liveClient
        .from('institutions')
        .select('id')
        .eq('slug', slug)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') { // Not found error
          this.logger.info('Institution not found, creating new one');
          const { data: newInstitution, error: insertError } = await this.liveClient
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
      const { error } = await this.liveClient.from('jobs').select('id').limit(1);
      if (error) throw error;

      // Initialize the NSW Capability Framework
      await this.initializeNSWCapabilityFramework();
      
      // Initialize taxonomy groups
      await this.initializeTaxonomyGroups();
      
      // Get or create institution
      const institutionId = await this.getOrCreateInstitution();
      this.config.institutionId = institutionId;
      this.logger.info('Initialization complete, using institution:', institutionId);
    } catch (error) {
      this.logger.error('Error initializing storage service:', error);
      throw error;
    }
  }

  /**
   * Initialize the NSW Capability Framework
   */
  private async initializeNSWCapabilityFramework(): Promise<void> {
    try {
      const capabilitiesPath = path.join(process.cwd(), 'database', 'seed', 'capabilities.json');
      if (!fs.existsSync(capabilitiesPath)) {
        this.logger.warn('Capabilities file not found:', capabilitiesPath);
        return;
      }

      const capabilitiesData = JSON.parse(fs.readFileSync(capabilitiesPath, 'utf8'));
      this.logger.info(`Loading ${capabilitiesData.length} capabilities...`);

      for (const capability of capabilitiesData) {
        const { error } = await this.stagingClient
          .from('capabilities')
          .upsert({
            id: capability.id,
            name: capability.name,
            group_name: capability.group_name,
            description: capability.description,
            source_framework: capability.source_framework || 'NSW Public Sector Capability Framework',
            is_occupation_specific: capability.is_occupation_specific || false,
            sync_status: 'pending',
            last_synced_at: null
          }, {
            onConflict: 'id'
          });

        if (error) throw error;
      }

      this.logger.info('NSW Capability Framework initialized');
    } catch (error) {
      this.logger.error('Error initializing NSW Capability Framework:', error);
        throw error;
    }
  }

  /**
   * Initialize taxonomy groups in the database
   */
  private async initializeTaxonomyGroups(): Promise<void> {
    try {
      // First check if the taxonomies table exists and has the correct schema
      const { error: tableError } = await this.stagingClient
        .from('taxonomy')
        .select('id')
        .limit(1);

      if (tableError) {
        this.logger.error('Error accessing taxonomy table:', {
          error: tableError,
          details: 'Make sure the taxonomy table exists with the correct schema'
        });
        throw tableError;
      }

      const taxonomiesPath = path.join(process.cwd(), 'database', 'seed', 'taxonomy.json');
      if (!fs.existsSync(taxonomiesPath)) {
        this.logger.warn('Taxonomies file not found:', taxonomiesPath);
        return;
      }

      const taxonomiesData = JSON.parse(fs.readFileSync(taxonomiesPath, 'utf8'));
      this.logger.info(`Loading ${taxonomiesData.length} taxonomies...`);

      for (const taxonomy of taxonomiesData) {
        try {
          const { error } = await this.stagingClient
            .from('taxonomy')
            .upsert({
              id: taxonomy.id,
              name: taxonomy.name,
              description: taxonomy.description,
              taxonomy_type: taxonomy.taxonomy_type,
              sync_status: 'pending',
              last_synced_at: null
            }, {
              onConflict: 'id'
            });

          if (error) {
            this.logger.error('Error upserting taxonomy:', {
              error,
              taxonomy: taxonomy.name,
              taxonomyId: taxonomy.id
            });
            throw error;
          }
    } catch (error) {
          this.logger.error('Error processing individual taxonomy:', {
            error: error instanceof Error ? {
              message: error.message,
              stack: error.stack,
              name: error.name
            } : error,
            taxonomy: taxonomy.name,
            taxonomyId: taxonomy.id
          });
          throw error;
        }
      }

      this.logger.info('Taxonomy groups initialized');
    } catch (error) {
      this.logger.error('Error initializing taxonomy groups:', {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error,
        taxonomiesPath: path.join(process.cwd(), 'database', 'seed', 'taxonomy.json')
      });
      throw error;
    }
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
      
      // First store the company
      const companyData = await this.storeCompanyRecord({
        name: job.jobDetails.agency || 'NSW Government',
        description: '',
        website: '',
        raw_data: job.jobDetails
      });

      // Store the role
      const roleData = await this.storeRoleRecord({
        title: job.jobDetails.title,
        company_id: companyData[0].id,
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
        .eq('company_id', companyData[0].id)
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
        company_id: companyData[0].id,
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

      // this.logger.info("Storing job record:", jobRecord);

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

      await this.storeCapabilityRecords(job, allCapabilities);
      await this.storeSkillRecords(job, allSkills);

        this.metrics.successfulStores++;
        this.metrics.totalStored++;
      this.logger.info(`Successfully stored job ${jobId}`);

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
      const { data, error } = await this.liveClient
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
      let query = this.liveClient
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
      const { data, error } = await this.liveClient
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
      const { data, error } = await this.liveClient
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
      const { data, error } = await this.liveClient
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
   * Log processing stats for both staging and live databases
   */
  async logProcessingStats(): Promise<void> {
    try {
      this.logger.info('\n----------------------------------------');
      this.logger.info('ETL Processing Summary');
      this.logger.info('----------------------------------------');

      // Get staging counts
      const stagingCounts = await this.getTableCounts(this.stagingClient);
      
      // Get live counts
      const liveCounts = await this.getTableCounts(this.liveClient);

      // Log the results
      this.logger.info('Staging Database Records:');
      this.logger.info(`✓ Companies: ${stagingCounts.companies}`);
      this.logger.info(`✓ Roles: ${stagingCounts.roles}`);
      this.logger.info(`✓ Jobs: ${stagingCounts.jobs}`);
      this.logger.info(`✓ Capabilities: ${stagingCounts.capabilities}`);
      this.logger.info(`✓ Skills: ${stagingCounts.skills}`);
      this.logger.info(`✓ Role Capabilities: ${stagingCounts.roleCapabilities}`);
      this.logger.info(`✓ Role Skills: ${stagingCounts.roleSkills}`);

      this.logger.info('\nLive Database Records:');
      this.logger.info(`✓ Companies: ${liveCounts.companies}`);
      this.logger.info(`✓ Roles: ${liveCounts.roles}`);
      this.logger.info(`✓ Jobs: ${liveCounts.jobs}`);
      this.logger.info(`✓ Capabilities: ${liveCounts.capabilities}`);
      this.logger.info(`✓ Skills: ${liveCounts.skills}`);
      this.logger.info(`✓ Role Capabilities: ${liveCounts.roleCapabilities}`);
      this.logger.info(`✓ Role Skills: ${liveCounts.roleSkills}`);

      // Log any mismatches
      const mismatches = [];
      if (stagingCounts.companies !== liveCounts.companies) mismatches.push('Companies');
      if (stagingCounts.roles !== liveCounts.roles) mismatches.push('Roles');
      if (stagingCounts.jobs !== liveCounts.jobs) mismatches.push('Jobs');
      if (stagingCounts.capabilities !== liveCounts.capabilities) mismatches.push('Capabilities');
      if (stagingCounts.skills !== liveCounts.skills) mismatches.push('Skills');
      if (stagingCounts.roleCapabilities !== liveCounts.roleCapabilities) mismatches.push('Role Capabilities');
      if (stagingCounts.roleSkills !== liveCounts.roleSkills) mismatches.push('Role Skills');

      if (mismatches.length > 0) {
        this.logger.warn('\nMismatches detected in:', mismatches.join(', '));
      }

      this.logger.info('----------------------------------------');
    } catch (error) {
      this.logger.error('Error getting processing stats:', error);
    }
  }

  /**
   * Get record counts from database
   */
  private async getTableCounts(client: SupabaseClient): Promise<{
    companies: number;
    roles: number;
    jobs: number;
    capabilities: number;
    skills: number;
    roleCapabilities: number;
    roleSkills: number;
  }> {
    const counts = {
      companies: 0,
      roles: 0,
      jobs: 0,
      capabilities: 0,
      skills: 0,
      roleCapabilities: 0,
      roleSkills: 0
    };

    try {
      const tables = ['companies', 'roles', 'jobs', 'capabilities', 'skills', 'role_capabilities', 'role_skills'];
      
      for (const table of tables) {
        const { count, error } = await client
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) throw error;

        const key = table.replace(/_(.)/g, m => m[1].toUpperCase()) as keyof typeof counts;
        counts[key] = count || 0;
      }
    } catch (error) {
      this.logger.error('Error getting table counts:', error);
    }

    return counts;
  }

  /**
   * Store job record
   */
  private async storeJobRecord(job: ProcessedJob): Promise<void> {
    try {
      const { jobDetails, capabilities, taxonomy } = job;

      // Format location as array
      const location = Array.isArray(jobDetails.location) 
        ? jobDetails.location 
        : [jobDetails.location];

      // Store company first
      const companyData = await this.storeCompanyRecord({
        name: jobDetails.agency,
        description: jobDetails.aboutUs || '',
        website: '',
        raw_data: jobDetails
      });

      if (!companyData || !companyData[0]) {
        throw new Error('Failed to store company record');
      }

      // Store role
      const roleData = await this.storeRoleRecord({
        title: jobDetails.title,
        company_id: companyData[0].id,
        raw_data: jobDetails
      });

      if (!roleData || !roleData[0]) {
        throw new Error('Failed to store role record');
      }

      // Store job
    const jobRecord = {
        original_id: jobDetails.id,
        source_id: 'nswgov',
        title: jobDetails.title,
        company_id: companyData[0].id,
        role_id: roleData[0].id,
        locations: Array.isArray(jobDetails.location) ? jobDetails.location : [jobDetails.location],
        remuneration: jobDetails.salary,
        close_date: jobDetails.closingDate === 'Ongoing' ? null : jobDetails.closingDate,
        open_date: jobDetails.postedDate || new Date().toISOString(),
        job_type: jobDetails.jobType,
        source_url: jobDetails.url,
        raw_json: jobDetails,
        sync_status: 'pending',
        last_synced_at: null,
        raw_data: jobDetails
    };

      const { error: jobError } = await this.stagingClient
      .from(this.config.jobsTable)
        .upsert(jobRecord)
        .select()
        .single();

      if (jobError) throw jobError;

      // Store job in live DB
      const liveJobRecord = {
        id: jobDetails.id,
        role_id: roleData[0].id,
        company_id: companyData[0].id,
        title: jobDetails.title,
        locations: Array.isArray(jobDetails.location) ? jobDetails.location : [jobDetails.location],
        remuneration: jobDetails.salary,
        close_date: jobDetails.closingDate === 'Ongoing' ? null : jobDetails.closingDate,
        open_date: jobDetails.postedDate || new Date().toISOString(),
        job_type: jobDetails.jobType,
        source_url: jobDetails.url,
        raw_json: jobDetails,
        sync_status: 'pending',
        last_synced_at: null,
        raw_data: jobDetails
      };

      const liveJobError = await this.liveClient
        .from(this.config.jobsTable)
        .upsert(liveJobRecord)
        .select()
        .single();

      if (liveJobError) throw liveJobError;

      // Store capabilities
      const allCapabilities = capabilities.capabilities || [];
      if (allCapabilities.length > 0) {
        for (const capability of allCapabilities) {
          try {
            const capabilityData = await this.storeCapabilityRecord({
              name: capability.name,
              description: capability.description,
              level: capability.level,
              raw_data: capability
            });

            if (capabilityData && capabilityData[0] && roleData && roleData[0]) {
              await this.storeRoleCapability(roleData[0].id, capabilityData[0].id, 'core', capability.level);
              this.logger.info(`Linked capability ${capability.name} to role ${roleData[0].id}`);
            }
          } catch (error) {
            this.logger.error('Error processing capability:', { error, capability: capability.name });
          }
        }
      }

      // Store skills
      const allSkills = capabilities.skills || [];
      if (allSkills.length > 0) {
        for (const skill of allSkills) {
          try {
            const skillData = await this.storeSkillRecord({
              name: skill.name,
              description: skill.description || '',
              category: skill.category || 'Technical',
              company_id: companyData[0].id,
              raw_data: skill
            });

            if (skillData && skillData[0] && roleData && roleData[0]) {
              await this.linkRoleSkill(roleData[0].id, skillData[0].id);
              this.logger.info(`Linked skill ${skill.name} to role ${roleData[0].id}`);
            }
          } catch (error) {
            this.logger.error('Error processing skill:', { error, skill: skill.name });
          }
        }
      }

      this.logger.info('Successfully stored job record:', { 
        stagingId: jobRecord.original_id, 
        liveId: liveJobRecord.id 
      });
    } catch (error) {
      this.logger.error('Error in storeJobRecord:', error);
      this.handleStorageError('insert', this.config.jobsTable, error, job.jobDetails.id);
      throw error;
    }
  }

  /**
   * Process job documents
   */
  private async processJobDocuments(jobId: string, documents: Array<{ url: string; title?: string; type?: string; }>): Promise<{ documents: any[], analysis: any }> {
    try {
      const processedDocs = [];
      let combinedAnalysis: {
        capabilities: Array<{
          name: string;
          level: string;
          description: string;
          behavioral_indicators: string[];
        }>;
        skills: Array<{
          name: string;
          description: string;
          category: string;
        }>;
      } = {
        capabilities: [],
        skills: []
      };

      this.logger.info(`Starting to process ${documents.length} documents for job ${jobId}:`, 
        documents.map(d => ({ url: d.url, title: d.title, type: d.type }))
      );

      for (const doc of documents) {
        try {
          // Download document
          this.logger.info(`Downloading document from ${doc.url}...`);
          const response = await fetch(doc.url);
          if (!response.ok) {
            this.logger.error(`Failed to download document: ${response.statusText}`, {
              url: doc.url,
              status: response.status,
              statusText: response.statusText
            });
            throw new Error(`Failed to download document: ${response.statusText}`);
          }

          this.logger.info(`Successfully downloaded document from ${doc.url}`, {
            contentType: response.headers.get('content-type'),
            contentLength: response.headers.get('content-length')
          });

          const buffer = await response.arrayBuffer();
          const contentType = response.headers.get('content-type');

          // Process document content
          let content = null;
          const tempFile = path.join(os.tmpdir(), `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`);
          fs.writeFileSync(tempFile, Buffer.from(buffer));

          try {
            if (contentType?.includes('pdf') || doc.url.toLowerCase().endsWith('.pdf')) {
              this.logger.info(`Processing PDF document: ${doc.url}`);
              const pdfParser = new PDFParser();
              content = await new Promise<string>((resolve, reject) => {
                pdfParser.on("pdfParser_dataReady", () => {
                  try {
                    const text = decodeURIComponent(pdfParser.getRawTextContent())
                      .replace(/\r\n/g, '\n')
                      .replace(/\n{3,}/g, '\n\n')
                      .trim();
                    resolve(text);
                  } catch (error) {
                    reject(error);
                  }
                });
                pdfParser.on("pdfParser_dataError", reject);
                pdfParser.loadPDF(tempFile);
              });
              this.logger.info(`Successfully extracted ${content?.length || 0} characters from PDF`);
            } else if (contentType?.includes('word') || doc.url.toLowerCase().endsWith('.docx')) {
              this.logger.info(`Processing Word document: ${doc.url}`);
              const result = await mammoth.extractRawText({ path: tempFile });
              content = result.value.trim();
              this.logger.info(`Successfully extracted ${content?.length || 0} characters from Word document`);
            }

            // Store document in job_documents table
            await this.storeJobDocument(jobId, {
              url: doc.url,
              title: doc.title,
              type: doc.type,
              content_type: contentType || undefined,
              content: content || undefined
            });

          } finally {
            // Clean up temp file
            try {
              fs.unlinkSync(tempFile);
            } catch (e) {
              this.logger.warn(`Failed to clean up temp file: ${tempFile}`, e);
            }
          }

          if (content) {
            // Analyze document content for capabilities and skills
            if (this.config.aiService) {
              this.logger.info(`Analyzing document content (${content.length} characters)`);
              const analysis = await this.config.aiService.analyzeText(content);
              
              processedDocs.push({
                url: doc.url,
                title: doc.title,
                type: doc.type,
                content_type: contentType,
                analysis: analysis
              });
              
              // Combine analysis results
              if (analysis) {
                this.logger.info('Document analysis results:', {
                  capabilities: analysis.capabilities.length,
                  skills: analysis.skills.length,
                  capabilities_list: analysis.capabilities.map(c => ({ name: c.name, level: c.level })),
                  skills_list: analysis.skills.map(s => ({ name: s.name, category: s.category }))
                });
                combinedAnalysis.capabilities.push(...analysis.capabilities);
                combinedAnalysis.skills.push(...analysis.skills);
              }
            }
          }
        } catch (error) {
          const err = error as Error;
          this.logger.error('Error processing document:', {
            jobId,
            document: doc,
            error: {
              message: err.message,
              stack: err.stack,
              details: err
            }
          });
        }
      }

      this.logger.info('Document processing summary:', {
        jobId,
        total_documents: documents.length,
        processed_documents: processedDocs.length,
        total_capabilities: combinedAnalysis.capabilities.length,
        total_skills: combinedAnalysis.skills.length
      });

      return {
        documents: processedDocs,
        analysis: combinedAnalysis
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error('Error in processJobDocuments:', {
        jobId,
        error: {
          message: err.message,
          stack: err.stack,
          details: err
        }
      });
      throw error;
    }
  }

  /**
   * Store job document record
   */
  private async storeJobDocument(jobId: string, document: {
    url: string;
    title?: string;
    type?: string;
    content_type?: string;
    content?: string;
  }): Promise<void> {
    try {
      const documentRecord = {
        job_id: jobId,
        document_url: document.url,
        document_type: document.type || 'doc',
        title: document.title,
        url: document.url,
        sync_status: 'pending',
        last_synced_at: null,
        raw_data: {
          url: document.url,
          title: document.title,
          type: document.type,
          content_type: document.content_type,
          content: document.content
        }
      };

      const { error } = await this.stagingClient
        .from('job_documents')
        .upsert(documentRecord, {
          onConflict: 'job_id,document_url'
        });

      if (error) {
        this.logger.error('Error storing job document:', {
          error,
          jobId,
          document: documentRecord
        });
        throw error;
      }

      this.logger.info(`Successfully stored document for job ${jobId}:`, {
        url: document.url,
        title: document.title,
        type: document.type
      });
    } catch (error) {
      this.logger.error('Error in storeJobDocument:', error);
      throw error;
    }
  }

  /**
   * Store company record in staging
   */
  private async storeCompanyRecord(company: { name: string; description: string; website: string; raw_data: any }): Promise<any[]> {
    try {
      if (!company) {
        throw new Error('Company object is required');
      }

      // Ensure we have a valid company name
      const companyName = (company.name || '').trim();
      if (!companyName) {
        throw new Error('Company name is required');
      }

      // First check if company exists
      const { data: existingCompany, error: fetchError } = await this.stagingClient
        .from('companies')
        .select('*')
        .eq('name', companyName)
        .maybeSingle();

      // If company exists, return it
      if (existingCompany) {
        this.logger.info(`Company ${companyName} already exists with id ${existingCompany.id}`);
        return [existingCompany];
      }

      // If error is not PGRST116 (no rows), throw it
      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      // Company doesn't exist, create it
      const companyData = {
        name: companyName,
        description: company.description || `${companyName} - NSW Government`,
        website: company.website || 'https://www.nsw.gov.au',
        sync_status: 'pending',
        last_synced_at: new Date().toISOString(),
        raw_data: company.raw_data
      };

      const { data, error: insertError } = await this.stagingClient
        .from('companies')
        .insert(companyData)
        .select();

      if (insertError) {
        this.logger.error('Error inserting company:', { error: insertError, company: companyData });
        throw insertError;
      }

      if (!data || data.length === 0) {
        throw new Error('No data returned after company insert');
      }

      this.logger.info(`Successfully inserted company: ${companyName} with id ${data[0].id}`);
      return data;
    } catch (error) {
      this.logger.error('Error storing company record:', error);
      throw error;
    }
  }

  /**
   * Store role record in staging
   */
  private async storeRoleRecord(role: { title: string; company_id: string; raw_data: any }): Promise<any[]> {
    try {
      // First check if role exists
      const { data: existingRole, error: fetchError } = await this.stagingClient
        .from(this.config.rolesTable)
        .select()
        .eq('company_id', role.company_id)
        .eq('title', role.title)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      const roleData = {
        title: role.title,
        company_id: role.company_id,
        sync_status: 'pending',
        last_synced_at: null,
        raw_data: role.raw_data
      };

      let result;
      if (existingRole) {
        const { data, error: updateError } = await this.stagingClient
          .from(this.config.rolesTable)
          .update(roleData)
          .eq('id', existingRole.id)
          .select();

        if (updateError) throw updateError;
        return data;
      } else {
        const { data, error: insertError } = await this.stagingClient
          .from(this.config.rolesTable)
          .insert(roleData)
          .select();

        if (insertError) throw insertError;
        return data;
      }
    } catch (error) {
      this.logger.error('Error storing role record:', error);
      throw error;
    }
  }

  /**
   * Store capability record in staging
   */
  private async storeCapabilityRecord(capability: { name: string; description: string; level: string; raw_data: any }): Promise<any[]> {
    try {
      const capabilityData = {
        name: capability.name,
        description: capability.description,
        source_framework: 'NSW Public Sector Capability Framework',
      is_occupation_specific: false,
        normalized_key: capability.name.toLowerCase().replace(/\s+/g, '_'),
        sync_status: 'pending',
        last_synced_at: null
      };

      // First check if capability exists
      const { data: existingCapability, error: fetchError } = await this.stagingClient
        .from('capabilities')
        .select()
        .eq('name', capability.name)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      let result;
      if (existingCapability) {
        const { data, error: updateError } = await this.stagingClient
          .from('capabilities')
          .update(capabilityData)
          .eq('id', existingCapability.id)
          .select();

        if (updateError) throw updateError;
        result = data;
      } else {
        const { data, error: insertError } = await this.stagingClient
          .from('capabilities')
          .insert(capabilityData)
          .select();

        if (insertError) throw insertError;
        result = data;
      }

      // Store capability level
      if (result && result[0]) {
        const { error: levelError } = await this.stagingClient
          .from('capability_levels')
          .upsert({
            capability_id: result[0].id,
            level: capability.level,
            summary: capability.description
          }, {
            onConflict: 'capability_id,level'
          });

        if (levelError) throw levelError;
      }

      return result;
    } catch (error) {
      this.logger.error('Error storing capability record:', error);
      throw error;
    }
  }

  /**
   * Store skill records
   */
  private async storeSkillRecords(job: ProcessedJob, skills: Array<{ name: string; description?: string; category?: string; text?: string }>): Promise<void> {
    try {
      // Get the company first
      const companyData = await this.storeCompanyRecord({
        name: job.jobDetails.agency || 'NSW Government',
        description: job.jobDetails.aboutUs || '',
        website: '',
        raw_data: job.jobDetails
      });

      if (!companyData || !companyData[0]) {
        throw new Error('Failed to get or create company');
      }

      const companyId = companyData[0].id;
      this.logger.info(`Using company ID ${companyId} for skills of job ${job.jobDetails.id}`);

      // Get the role ID
      const { data: roleData, error: roleError } = await this.stagingClient
        .from('roles')
        .select('id')
        .eq('title', job.jobDetails.title)
        .eq('company_id', companyId)
        .single();

      if (roleError) {
        this.logger.error('Error fetching role:', roleError);
        throw roleError;
      }

      if (!roleData) {
        this.logger.error('Role not found:', {
          title: job.jobDetails.title,
          company: job.jobDetails.agency
        });
        throw new Error('Role not found');
      }

      const roleId = roleData.id;
      this.logger.info(`Found role ID ${roleId} for job ${job.jobDetails.id}`);

      // Store each skill and link to role
      for (const skill of skills) {
        try {
          // Upsert skill
          const skillRecord = await this.upsertSkill(skill, companyId);
          
          // Link skill to role
          await this.linkRoleSkill(roleId, skillRecord.id);

          this.logger.info(`Successfully processed skill ${skillRecord.name} for role ${roleId}`);
        } catch (error) {
          this.logger.error('Error processing skill:', { error, skill: skill.name || skill.text });
        }
      }
    } catch (error) {
      this.logger.error('Error in storeSkillRecords:', error);
      throw error;
    }
  }

  /**
   * Store capability records
   */
  private async storeCapabilityRecords(job: ProcessedJob, capabilities: Capability[]): Promise<void> {
    try {
      // Get the company first
      const { data: companyData, error: companyError } = await this.stagingClient
        .from('companies')
        .select('id')
        .eq('name', job.jobDetails.agency)
        .single();

      if (companyError) {
        this.logger.error('Error fetching company:', companyError);
        throw companyError;
      }

      if (!companyData) {
        this.logger.error('Company not found:', job.jobDetails.agency);
        throw new Error('Company not found');
      }

      // Get the role ID
      const { data: roleData, error: roleError } = await this.stagingClient
        .from('roles')
        .select('id')
        .eq('title', job.jobDetails.title)
        .eq('company_id', companyData.id)
        .single();

      if (roleError) {
        this.logger.error('Error fetching role:', roleError);
        throw roleError;
      }

      if (!roleData) {
        this.logger.error('Role not found:', {
          title: job.jobDetails.title,
          company: job.jobDetails.agency
        });
        throw new Error('Role not found');
      }

      const roleId = roleData.id;
      this.logger.info(`Found role ID ${roleId} for job ${job.jobDetails.id}`);

      // Link each capability to the role
      for (const capability of capabilities) {
        try {
          if (!capability.id) {
            this.logger.warn('Skipping capability with no ID');
            continue;
          }

          // Link capability to role
          const { error: linkError } = await this.stagingClient
            .from('role_capabilities')
            .upsert({
              role_id: roleId,
              capability_id: capability.id,
              capability_type: 'core',
              level: capability.level,
              sync_status: 'pending',
              last_synced_at: null
            }, {
              onConflict: 'role_id,capability_id'
            });

          if (linkError) {
            this.logger.error('Error linking capability to role:', {
              error: linkError,
              capability: capability.name,
              roleId
            });
            continue;
          }

          this.logger.info(`Successfully linked capability ${capability.name} (${capability.id}) to role ${roleId}`);
        } catch (error) {
          this.logger.error('Error processing capability:', { error, capability: capability.name });
        }
      }
    } catch (error) {
      this.logger.error('Error in storeCapabilityRecords:', error);
      throw error;
    }
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
      ...job.embeddings.capabilities.filter((emb): emb is EmbeddingResult => emb !== undefined).map((emb, i) => ({
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

    const { error } = await this.liveClient
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
      technicalSkills: job.taxonomy?.technicalSkills || [],
      softSkills: job.taxonomy?.softSkills || [],
      raw_data: job.taxonomy,
      processed: false,
      processing_status: 'pending',
      processedAt: job.metadata.processedAt
    };

    this.logger.info('Upserting taxonomy record to database:', taxonomyRecord);
    const { data, error } = await this.liveClient
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
   * Store AI model invocation record
   */
  public async storeAIInvocation(invocation: {
    session_id?: string;
    action_type: string;
    model_provider: 'openai' | 'anthropic' | 'cohere';
    model_name: string;
    temperature?: number;
    max_tokens?: number;
    system_prompt?: string;
    user_prompt: string;
    messages?: any;
    other_params?: any;
    response_text: string;
    response_metadata?: any;
    token_usage?: any;
    status: 'success' | 'error';
    error_message?: string;
    latency_ms?: number;
  }): Promise<void> {
    try {
      const { error } = await this.stagingClient
        .from('ai_model_invocations')
        .insert({
          ...invocation,
          created_at: new Date().toISOString()
        });

      if (error) {
        this.logger.error('Error storing AI invocation:', error);
        throw error;
      }

      this.logger.info('Successfully stored AI invocation:', {
        action_type: invocation.action_type,
        model_name: invocation.model_name,
        status: invocation.status
      });
    } catch (error) {
      this.handleStorageError('insert', 'ai_model_invocations', error);
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.logProcessingStats();
      await this.liveClient.auth.signOut();
      this.logger.info('Successfully cleaned up storage service');
    } catch (error) {
      this.logger.error('Error cleaning up storage service:', error);
    }
  }

  /**
   * Store role capability relationship in staging
   */
  private async storeRoleCapability(roleId: string, capabilityId: string, capabilityType: string, level: string): Promise<void> {
    try {
      const { error } = await this.stagingClient
        .from('role_capabilities')
        .upsert({
          role_id: roleId,
          capability_id: capabilityId,
          capability_type: capabilityType,
          level: level,
          sync_status: 'pending',
          last_synced_at: null
        }, {
          onConflict: 'role_id,capability_id,capability_type'
        });

      if (error) throw error;
      this.logger.info(`Successfully linked capability ${capabilityId} to role ${roleId}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error('Error storing role capability:', {
        error: {
          message: err.message,
          stack: err.stack,
          details: err
        },
        roleId,
        capabilityId
      });
      throw error;
    }
  }

  /**
   * Store role skill relationship in staging
   */
  private async linkRoleSkill(roleId: string, skillId: string): Promise<void> {
    try {
      const { error } = await this.stagingClient
        .from('role_skills')
        .upsert({
          role_id: roleId,
          skill_id: skillId,
          sync_status: 'pending',
          last_synced_at: null
        }, {
          onConflict: 'role_id,skill_id'
        });

      if (error) throw error;
      this.logger.info(`Successfully linked skill ${skillId} to role ${roleId}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error('Error storing role skill:', {
        error: {
          message: err.message,
          stack: err.stack,
          details: err
        },
        roleId,
        skillId
      });
      throw error;
    }
  }

  /**
   * Store skill record in staging
   */
  private async storeSkillRecord(skill: { name: string; description: string; category: string; company_id: string; raw_data: any }): Promise<any[]> {
    try {
      const skillData = {
        name: skill.name,
        description: skill.description,
        category: skill.category,
        source: 'job_description',
        is_occupation_specific: true,
        company_id: skill.company_id,
        sync_status: 'pending',
        last_synced_at: null,
        raw_data: skill.raw_data
      };

      const { data, error } = await this.stagingClient
        .from('skills')
        .upsert(skillData, {
          onConflict: 'name,company_id'
        })
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      this.logger.error('Error storing skill record:', error);
      throw error;
    }
  }

  /**
   * Get capabilities from the framework
   */
  async getFrameworkCapabilities(): Promise<Array<{
    id: string;
    name: string;
    description: string;
    group_name: string;
    embedding?: any;
  }>> {
    try {
      // First try to get capabilities with embeddings
      const { data: capabilitiesWithEmbeddings, error: embeddingError } = await this.stagingClient
        .from('capabilities')
        .select('id, name, description, group_name, embedding')
        .eq('source_framework', 'NSW Public Sector Capability Framework');

      if (embeddingError) throw embeddingError;
      return capabilitiesWithEmbeddings || [];
    } catch (error) {
      this.logger.error('Error getting framework capabilities:', error);
      throw error;
    }
  }

  /**
   * Store capability embeddings
   */
  async storeCapabilityEmbeddings(capabilities: Array<{
    id: string;
    name: string;
    description: string;
    group_name: string;
    embedding: any;
  }>): Promise<void> {
    try {
      this.logger.info(`Storing embeddings for ${capabilities.length} capabilities`);
      
      // Update capabilities with their embeddings
      for (const capability of capabilities) {
        // Format the vector data for Postgres
        const vector = capability.embedding.vector;
        const formattedVector = Array.isArray(vector) ? `[${vector.join(',')}]` : vector;

        const { error } = await this.stagingClient
          .from('capabilities')
          .update({ 
            embedding: formattedVector
          })
          .eq('id', capability.id);

        if (error) {
          this.logger.error(`Error storing embedding for capability ${capability.id}:`, error);
          throw error;
        }
      }

      this.logger.info('Successfully stored capability embeddings');
    } catch (error) {
      this.logger.error('Error storing capability embeddings:', error);
      throw error;
    }
  }

  /**
   * Get taxonomy groups
   */
  async getTaxonomyGroups(): Promise<Array<{
    id: string;
    name: string;
    description: string;
  }>> {
    try {
      this.logger.info('Getting taxonomy groups');

      const { data, error } = await this.stagingClient
        .from('taxonomy')
        .select('id, name, description')
        .eq('taxonomy_type', 'core')
        .order('name');

      if (error) {
        throw error;
      }

      this.logger.info(`Retrieved ${data.length} taxonomy groups`);
      return data;
    } catch (error) {
      this.logger.error('Error getting taxonomy groups:', error);
      throw error;
    }
  }

  /**
   * Get or create a role for a job
   */
  async getRoleByJobDetails(job: JobDetails): Promise<{ id: string; title: string } | null> {
    try {
      // First create/get the company
      const companyData = await this.storeCompanyRecord({
        name: job.agency || 'NSW Government',
        description: job.aboutUs || '',
        website: '',
        raw_data: job
      });

      if (!companyData || !companyData[0]) {
        throw new Error('Failed to get or create company');
      }

      const companyId = companyData[0].id;
      this.logger.info(`Using company ID ${companyId} for job ${job.id}`);

      // Get or create the role
      const { data: roleData, error: roleError } = await this.stagingClient
        .from('roles')
        .select('id, title')
        .eq('title', job.title)
        .eq('company_id', companyId)
        .maybeSingle();

      // If role exists, return it
      if (roleData) {
        this.logger.info(`Found existing role: ${roleData.title} (${roleData.id})`);
        return roleData;
      }

      // If error is not PGRST116 (no rows), throw it
      if (roleError && roleError.code !== 'PGRST116') {
        throw roleError;
      }

      // Role doesn't exist, create it
      const { data: newRoleData, error: createError } = await this.stagingClient
        .from('roles')
        .insert({
          title: job.title,
          company_id: companyId,
          sync_status: 'pending',
          last_synced_at: null,
          raw_data: job
        })
        .select('id, title')
        .single();

      if (createError) {
        this.logger.error('Error creating role:', createError);
        throw createError;
      }

      if (!newRoleData) {
        throw new Error('No data returned after role creation');
      }

      this.logger.info(`Created new role: ${newRoleData.title} (${newRoleData.id})`);
      return newRoleData;
    } catch (error) {
      this.logger.error('Error in getRoleByJobDetails:', error);
      throw error;
    }
  }

  /**
   * Upsert a single skill to staging
   */
  private async upsertSkill(skill: { 
    name: string; 
    description?: string; 
    category?: string; 
    text?: string 
  }, companyId: string): Promise<{ id: string; name: string }> {
    try {
      const skillName = skill.name || skill.text || '';
      if (!skillName) {
        throw new Error('Skill name is required');
      }

      // First check if skill exists
      const { data: existingSkill, error: checkError } = await this.stagingClient
        .from('skills')
        .select('id, name')
        .eq('name', skillName)
        .eq('company_id', companyId)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        this.logger.error('Error checking existing skill:', {
          error: checkError,
          skill: skillName
        });
        throw checkError;
      }

      const skillData = {
        name: skillName,
        description: skill.description || skillName,
        source: 'job_description',
        is_occupation_specific: true,
        company_id: companyId,
        category: skill.category || 'Technical',
        sync_status: 'pending',
        last_synced_at: null,
        raw_data: skill
      };

      let result;
      if (existingSkill) {
        // Update existing skill
        const { data, error: updateError } = await this.stagingClient
          .from('skills')
          .update(skillData)
          .eq('id', existingSkill.id)
          .select('id, name')
          .single();

        if (updateError) {
          this.logger.error('Error updating skill:', {
            error: updateError,
            skill: skillName
          });
          throw updateError;
        }
        result = data;
        this.logger.info(`Successfully updated skill: ${skillName}`);
      } else {
        // Insert new skill
        const { data, error: insertError } = await this.stagingClient
          .from('skills')
          .insert(skillData)
          .select('id, name')
          .single();

        if (insertError) {
          this.logger.error('Error inserting skill:', {
            error: insertError,
            skill: skillName
          });
          throw insertError;
        }
        result = data;
        this.logger.info(`Successfully inserted skill: ${skillName}`);
      }

      return result;
    } catch (error) {
      this.logger.error('Error in upsertSkill:', {
        skill: skill.name || skill.text,
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack
        } : error
      });
      throw error;
    }
  }

  /**
   * Store role-taxonomy relationships
   */
  async storeRoleTaxonomies(roleTaxonomies: Array<{
    roleId: string;
    taxonomyId: string;
  }>): Promise<void> {
    try {
      this.logger.info(`Storing ${roleTaxonomies.length} role-taxonomy relationships`);

      // Process in batches
      for (let i = 0; i < this.config.batchSize; i += this.config.batchSize) {
        const batch = roleTaxonomies.slice(i, i + this.config.batchSize);
        
        // Insert role-taxonomy relationships
        const { error } = await this.stagingClient
          .from('role_taxonomies')
          .upsert(
            batch.map(rt => ({
              role_id: rt.roleId,
              taxonomy_id: rt.taxonomyId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })),
            {
              onConflict: 'role_id,taxonomy_id'
            }
          );

        if (error) {
          throw error;
        }
      }

      this.logger.info('Successfully stored role-taxonomy relationships');
    } catch (error) {
      this.logger.error('Error storing role-taxonomy relationships:', error);
      throw error;
    }
  }

  /**
   * Get similar general roles based on embedding
   */
  async getSimilarGeneralRoles(embedding: number[]): Promise<Array<{
    id: string;
    name: string;
    description: string;
    similarity: number;
  }>> {
    try {
      // Convert embedding to Postgres vector format
      const vector = `[${embedding.join(',')}]`;

      // Query similar roles using cosine similarity
      const { data, error } = await this.stagingClient.rpc('match_general_roles', {
        query_embedding: vector,
        match_threshold: 0.5,
        match_count: 5
      });

      if (error) {
        this.logger.error('Error getting similar general roles:', error);
        throw error;
      }

      return data.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        similarity: row.similarity
      }));
    } catch (error) {
      this.logger.error('Error in getSimilarGeneralRoles:', error);
      return [];
    }
  }

  /**
   * Store or update a general role
   */
  async storeGeneralRole(role: {
    id?: string;
    title: string;
    description: string;
    function_area: string;
    classification_level: string;
    raw_data?: any;
  }): Promise<{ id: string }> {
    try {
      const roleData = {
        title: role.title,
        description: role.description,
        function_area: role.function_area,
        classification_level: role.classification_level
      };

      if (role.id) {
        // Update existing role
        const { data, error } = await this.stagingClient
          .from('general_roles')
          .update(roleData)
          .eq('id', role.id)
          .select('id')
          .single();

        if (error) throw error;
        return data;
      } else {
        // Check if role with same title exists
        const { data: existingRole, error: checkError } = await this.stagingClient
          .from('general_roles')
          .select('id')
          .eq('title', role.title)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') throw checkError;

        if (existingRole) {
          return existingRole;
        }

        // Create new role
        const { data, error } = await this.stagingClient
          .from('general_roles')
          .insert(roleData)
          .select('id')
          .single();

        if (error) throw error;
        return data;
      }
    } catch (error) {
      this.logger.error('Error storing general role:', error);
      throw error;
    }
  }

  /**
   * Link a role to a general role
   */
  async linkRoleToGeneralRole(roleId: string, generalRoleId: string): Promise<void> {
    try {
      const { error } = await this.stagingClient
        .from('roles')
        .update({ general_role_id: generalRoleId })
        .eq('id', roleId);

      if (error) throw error;
      this.logger.info(`Successfully linked role ${roleId} to general role ${generalRoleId}`);
    } catch (error) {
      this.logger.error('Error linking role to general role:', error);
      throw error;
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
} 