/**
 * @file CapabilityStorage.ts
 * @description Handles all capability-related database operations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../utils/logger.js';
import { Capability, ProcessedJob, QueryOptions } from './types.js';
import { CompanyStorage } from './CompanyStorage.js';

export class CapabilityStorage {
  constructor(
    private stagingClient: SupabaseClient,
    private liveClient: SupabaseClient,
    private logger: Logger,
    private companies: CompanyStorage
  ) {}

  /**
   * Create a new capability
   */
  async createCapability(capability: Omit<Capability, 'id' | 'created_at' | 'updated_at'>): Promise<Capability | null> {
    try {
      const { data, error } = await this.stagingClient
        .from('capabilities')
        .insert(capability)
        .select()
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      this.logger.error('Error in createCapability:', error);
      throw error;
    }
  }

  /**
   * Update an existing capability
   */
  async updateCapability(id: string, capability: Partial<Capability>): Promise<Capability | null> {
    try {
      const { data, error } = await this.stagingClient
        .from('capabilities')
        .update(capability)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      this.logger.error('Error in updateCapability:', error);
      throw error;
    }
  }

  /**
   * Get a capability by ID
   */
  async getCapabilityById(id: string): Promise<Capability | null> {
    try {
      const { data, error } = await this.liveClient
        .from('capabilities')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      this.logger.error('Error in getCapabilityById:', error);
      return null;
    }
  }

  /**
   * Get capabilities by filter criteria
   */
  async getCapabilitiesByFilter(filters: Record<string, any>, options?: QueryOptions): Promise<Capability[]> {
    try {
      let query = this.liveClient
        .from('capabilities')
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
      this.logger.error('Error in getCapabilitiesByFilter:', error);
      return [];
    }
  }

  /**
   * Delete a capability by ID
   */
  async deleteCapability(id: string): Promise<void> {
    try {
      const { error } = await this.stagingClient
        .from('capabilities')
        .delete()
        .eq('id', id);

      if (error) throw error;

    } catch (error) {
      this.logger.error('Error in deleteCapability:', error);
      throw error;
    }
  }

  /**
   * Get capabilities by category
   */
  async getCapabilitiesByCategory(category: string, options?: QueryOptions): Promise<Capability[]> {
    try {
      let query = this.liveClient
        .from('capabilities')
        .select('*')
        .eq('category', category);

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
      this.logger.error('Error in getCapabilitiesByCategory:', error);
      return [];
    }
  }

  /**
   * Search capabilities by name
   */
  async searchCapabilitiesByName(searchTerm: string, options?: QueryOptions): Promise<Capability[]> {
    try {
      let query = this.liveClient
        .from('capabilities')
        .select('*')
        .ilike('name', `%${searchTerm}%`);

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
      this.logger.error('Error in searchCapabilitiesByName:', error);
      return [];
    }
  }

  /**
   * Get framework capabilities
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
   * Store capability records
   */
  async storeCapabilityRecords(job: ProcessedJob, capabilities: Array<{
    id?: string;
    name: string;
    level: string;
    description: string;
    behavioral_indicators: string[];
  }>): Promise<void> {
    try {
      // Get or create the company first
      const company = await this.companies.getOrCreateCompany({
        name: job.jobDetails.agency || 'NSW Government',
        description: job.jobDetails.aboutUs || '',
        website: '',
        raw_data: job.jobDetails
      });

      if (!company) {
        this.logger.error('Company not found:', job.jobDetails.agency);
        throw new Error('Company not found');
      }

      // Get the role ID
      const { data: roleData, error: roleError } = await this.stagingClient
        .from('roles')
        .select('id')
        .eq('title', job.jobDetails.title)
        .eq('company_id', company.id)
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
} 