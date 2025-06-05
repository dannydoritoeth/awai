/**
 * @file StorageService.ts
 * @description Main storage service that exports all storage modules
 */

import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { Logger } from '../../utils/logger.js';
import path from 'path';
import fs from 'fs';

import { CompanyStorage } from './CompanyStorage.js';
import { JobStorage } from './JobStorage.js';
import { RoleStorage } from './RoleStorage.js';
import { CapabilityStorage } from './CapabilityStorage.js';
import { SkillStorage } from './SkillStorage.js';
import { TaxonomyStorage } from './TaxonomyStorage.js';
import { InstitutionStorage } from './InstitutionStorage.js';
import { AIModelStorage } from './AIModelStorage.js';

interface StorageConfig {
  stagingSupabaseUrl: string;
  stagingSupabaseKey: string;
  liveSupabaseUrl: string;
  liveSupabaseKey: string;
  jobsTable?: string;
  companiesTable?: string;
  rolesTable?: string;
  skillsTable?: string;
  capabilitiesTable?: string;
  embeddingsTable?: string;
  taxonomyTable?: string;
  batchSize?: number;
  maxRetries?: number;
  retryDelay?: number;
  institutionId?: string;
}

export class StorageService {
  public readonly companies: CompanyStorage;
  public readonly jobs: JobStorage;
  public readonly roles: RoleStorage;
  public readonly capabilities: CapabilityStorage;
  public readonly skills: SkillStorage;
  public readonly taxonomies: TaxonomyStorage;
  public readonly institutions: InstitutionStorage;
  public readonly aiModels: AIModelStorage;

  private readonly stagingClient: SupabaseClient;
  private readonly liveClient: SupabaseClient;
  private readonly logger: Logger;

  // Method bindings
  public readonly getOrCreateCompany: typeof CompanyStorage.prototype.getOrCreateCompany;
  public readonly storeJob: typeof JobStorage.prototype.storeJob;
  public readonly storeBatch: typeof JobStorage.prototype.storeBatch;
  public readonly getJobById: typeof JobStorage.prototype.getJobById;
  public readonly getJobsByFilter: typeof JobStorage.prototype.getJobsByFilter;
  public readonly checkExistingSyncedJob: typeof JobStorage.prototype.checkExistingSyncedJob;
  public readonly getRoleByJobDetails: typeof RoleStorage.prototype.getRoleByJobDetails;
  public readonly storeCapabilityEmbeddings: typeof CapabilityStorage.prototype.storeCapabilityEmbeddings;
  public readonly storeAIInvocation: typeof AIModelStorage.prototype.storeAIInvocation;
  public readonly storeRoleTaxonomies: typeof RoleStorage.prototype.storeRoleTaxonomies;
  public readonly storeSkillRecord: typeof SkillStorage.prototype.storeSkillRecord;
  public readonly storeSkillRecords: typeof SkillStorage.prototype.storeSkillRecords;

  constructor(configOrClient: StorageConfig | SupabaseClient, loggerOrLiveClient: Logger | SupabaseClient, logger?: Logger) {
    // Handle both constructor signatures
    if ('stagingSupabaseUrl' in configOrClient) {
      // Config object provided
      const config = configOrClient as StorageConfig;
      this.stagingClient = createClient(config.stagingSupabaseUrl, config.stagingSupabaseKey);
      this.liveClient = createClient(config.liveSupabaseUrl, config.liveSupabaseKey);
      this.logger = loggerOrLiveClient as Logger;
    } else {
      // Direct client injection
      this.stagingClient = configOrClient as SupabaseClient;
      this.liveClient = loggerOrLiveClient as SupabaseClient;
      this.logger = logger!;
    }

    // Initialize storage modules
    this.companies = new CompanyStorage(this.stagingClient, this.liveClient, this.logger);
    this.jobs = new JobStorage(this.stagingClient, this.liveClient, this.logger);
    this.roles = new RoleStorage(this.stagingClient, this.liveClient, this.logger, this.companies);
    this.capabilities = new CapabilityStorage(this.stagingClient, this.liveClient, this.logger);
    this.skills = new SkillStorage(this.stagingClient, this.liveClient, this.logger, this.companies);
    this.taxonomies = new TaxonomyStorage(this.stagingClient, this.liveClient, this.logger);
    this.institutions = new InstitutionStorage(this.stagingClient, this.liveClient, this.logger);
    this.aiModels = new AIModelStorage(this.stagingClient, this.liveClient, this.logger);

    // Bind methods
    this.getOrCreateCompany = this.companies.getOrCreateCompany.bind(this.companies);
    this.storeJob = this.jobs.storeJob.bind(this.jobs);
    this.storeBatch = this.jobs.storeBatch.bind(this.jobs);
    this.getJobById = this.jobs.getJobById.bind(this.jobs);
    this.getJobsByFilter = this.jobs.getJobsByFilter.bind(this.jobs);
    this.checkExistingSyncedJob = this.jobs.checkExistingSyncedJob.bind(this.jobs);
    this.getRoleByJobDetails = this.roles.getRoleByJobDetails.bind(this.roles);
    this.storeCapabilityEmbeddings = this.capabilities.storeCapabilityEmbeddings.bind(this.capabilities);
    this.storeAIInvocation = this.aiModels.storeAIInvocation.bind(this.aiModels);
    this.storeRoleTaxonomies = this.roles.storeRoleTaxonomies.bind(this.roles);
    this.storeSkillRecord = this.skills.storeSkillRecord.bind(this.skills);
    this.storeSkillRecords = this.skills.storeSkillRecords.bind(this.skills);

    this.logger.info('Storage service initialized');
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
      const institutionId = await this.institutions.getOrCreateInstitution();
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
   * Log processing stats for both staging and live databases
   */
  private async logProcessingStats(): Promise<void> {
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
   * Get framework capabilities
   */
  async getFrameworkCapabilities() {
    return this.capabilities.getFrameworkCapabilities();
  }

  /**
   * Get taxonomy groups
   */
  async getTaxonomyGroups() {
    return this.taxonomies.getTaxonomyGroups();
  }
}

// Re-export all storage classes
export { CompanyStorage } from './CompanyStorage.js';
export { JobStorage } from './JobStorage.js';
export { RoleStorage } from './RoleStorage.js';
export { CapabilityStorage } from './CapabilityStorage.js';
export { SkillStorage } from './SkillStorage.js';
export { TaxonomyStorage } from './TaxonomyStorage.js';
export { InstitutionStorage } from './InstitutionStorage.js';
export { AIModelStorage } from './AIModelStorage.js'; 