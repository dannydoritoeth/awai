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
import path from 'path';
import fs from 'fs';

export class StorageService implements IStorageService {
  private liveClient: SupabaseClient;
  private stagingClient: SupabaseClient;
  private metrics: StorageMetrics;

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

      // Initialize NSW Capability Framework
      await this.initializeNSWCapabilityFramework();

      // Get or create institution
      const institutionId = await this.getOrCreateInstitution();
      this.config.institutionId = institutionId;
      this.logger.info('Initialization complete, using institution:', institutionId);
    } catch (error) {
      this.logger.error('Initialization failed:', error);
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
   * Store a processed job and its related data
   */
  async storeJob(job: ProcessedJob): Promise<void> {
    try {
      const jobId = job.jobDetails.id;
      if (!jobId) throw new Error('Job ID is required');

      this.logger.info(`Processing job ${jobId}: ${job.jobDetails.title}`);
      
      await this.storeJobRecord(job);
      await this.storeCapabilityRecords(job);
      await this.storeEmbeddingRecords(job);
      await this.storeTaxonomyRecord(job);

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

      // First store the company
      const companyData = await this.storeCompanyRecord({
        name: job.jobDetails.agency,
        description: '',
        website: '',
        raw_data: job.jobDetails
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
      const { data: existingJob, error: fetchError } = await this.liveClient
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
        const { data, error: updateError } = await this.liveClient
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
        const { data, error: insertError } = await this.liveClient
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

      // Store role record
      const roleData = await this.storeRoleRecord({
        title: job.jobDetails.title,
        company_id: companyData[0].id,
        raw_data: job.jobDetails
      });

      // Process capabilities and skills
      if (job.capabilities && job.capabilities.capabilities) {
        for (const capability of job.capabilities.capabilities) {
          const capabilityData = await this.storeCapabilityRecord({
            name: capability.name,
            description: capability.description,
            level: capability.level,
            raw_data: capability
          });

          if (capabilityData && capabilityData[0] && roleData && roleData[0]) {
            await this.storeRoleCapability(roleData[0].id, capabilityData[0].id, 'core', capability.level);
          }
        }
      }

      if (job.capabilities && job.capabilities.skills) {
        for (const skill of job.capabilities.skills) {
          const skillData = await this.storeSkillRecord({
            name: skill.name,
            description: skill.description || '',
            category: skill.category || 'Technical',
            company_id: companyData[0].id,
            raw_data: skill
          });

          if (skillData && skillData[0] && roleData && roleData[0]) {
            await this.storeRoleSkill(roleData[0].id, skillData[0].id);
          }
        }
      }

      this.logger.info('Successfully stored job record:', result);
    } catch (error) {
      this.logger.error('Error in storeJobRecord:', error);
      this.handleStorageError('insert', this.config.jobsTable, error, job.jobDetails.id);
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
        .select('id, name')
        .eq('name', companyName)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingCompany) {
        this.logger.info(`Company ${companyName} already exists with id ${existingCompany.id}`);
        return [existingCompany];
      }

      // If company doesn't exist, insert it
      const { data, error: insertError } = await this.stagingClient
        .from('companies')
        .insert({
          name: companyName,
          description: company.description || `${companyName} - NSW Government`,
          website: company.website || 'https://www.nsw.gov.au',
          sync_status: 'pending',
          last_synced_at: new Date().toISOString(),
          raw_data: company
        })
        .select();

      if (insertError) throw insertError;
      this.logger.info(`Successfully inserted company: ${companyName}`);
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
      const roleData = {
        title: role.title,
        company_id: role.company_id,
        normalized_key: role.title.toLowerCase().replace(/\s+/g, '_'),
        sync_status: 'pending',
        last_synced_at: null
      };

      // First check if role exists
      const { data: existingRole, error: fetchError } = await this.stagingClient
        .from('roles')
        .select()
        .eq('company_id', role.company_id)
        .eq('normalized_key', roleData.normalized_key)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingRole) {
        const { data, error: updateError } = await this.stagingClient
          .from('roles')
          .update(roleData)
          .eq('id', existingRole.id)
          .select();

        if (updateError) throw updateError;
        return data;
      } else {
        const { data, error: insertError } = await this.stagingClient
          .from('roles')
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
        normalized_key: skill.name.toLowerCase().replace(/\s+/g, '_'),
        sync_status: 'pending',
        last_synced_at: null
      };

      // First check if skill exists
      const { data: existingSkill, error: fetchError } = await this.stagingClient
        .from('skills')
        .select()
        .eq('name', skill.name)
        .eq('company_id', skill.company_id)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingSkill) {
        const { data, error: updateError } = await this.stagingClient
          .from('skills')
          .update(skillData)
          .eq('id', existingSkill.id)
          .select();

        if (updateError) throw updateError;
        return data;
      } else {
        const { data, error: insertError } = await this.stagingClient
          .from('skills')
          .insert(skillData)
          .select();

        if (insertError) throw insertError;
        return data;
      }
    } catch (error) {
      this.logger.error('Error storing skill record:', error);
      throw error;
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
          onConflict: 'role_id,capability_id'
        });

      if (error) throw error;
    } catch (error) {
      this.logger.error('Error storing role capability:', error);
      throw error;
    }
  }

  /**
   * Store role skill relationship in staging
   */
  private async storeRoleSkill(roleId: string, skillId: string): Promise<void> {
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
    } catch (error) {
      this.logger.error('Error storing role skill:', error);
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

    const { error } = await this.liveClient
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
      vector: job.taxonomy.vector,
      text: job.taxonomy.text,
      metadata: job.taxonomy.metadata,
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
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      // Close Supabase client
      await this.liveClient.auth.signOut();
      this.logger.info('Successfully cleaned up storage service');
    } catch (error) {
      this.logger.error('Error cleaning up storage service:', error);
    }
  }
} 