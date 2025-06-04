/**
 * @file InstitutionStorage.ts
 * @description Handles all institution-related database operations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../utils/logger.js';
import { Institution, QueryOptions } from './types.js';

export class InstitutionStorage {
  constructor(
    private stagingClient: SupabaseClient,
    private liveClient: SupabaseClient,
    private logger: Logger
  ) {}

  /**
   * Create a new institution
   */
  async createInstitution(institution: Omit<Institution, 'id' | 'created_at' | 'updated_at'>): Promise<Institution | null> {
    try {
      const { data, error } = await this.stagingClient
        .from('institutions')
        .insert(institution)
        .select()
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      this.logger.error('Error in createInstitution:', error);
      throw error;
    }
  }

  /**
   * Update an existing institution
   */
  async updateInstitution(id: string, institution: Partial<Institution>): Promise<Institution | null> {
    try {
      const { data, error } = await this.stagingClient
        .from('institutions')
        .update(institution)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      this.logger.error('Error in updateInstitution:', error);
      throw error;
    }
  }

  /**
   * Get an institution by ID
   */
  async getInstitutionById(id: string): Promise<Institution | null> {
    try {
      const { data, error } = await this.liveClient
        .from('institutions')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      this.logger.error('Error in getInstitutionById:', error);
      return null;
    }
  }

  /**
   * Get institutions by filter criteria
   */
  async getInstitutionsByFilter(filters: Record<string, any>, options?: QueryOptions): Promise<Institution[]> {
    try {
      let query = this.liveClient
        .from('institutions')
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
      this.logger.error('Error in getInstitutionsByFilter:', error);
      return [];
    }
  }

  /**
   * Delete an institution by ID
   */
  async deleteInstitution(id: string): Promise<void> {
    try {
      const { error } = await this.stagingClient
        .from('institutions')
        .delete()
        .eq('id', id);

      if (error) throw error;

    } catch (error) {
      this.logger.error('Error in deleteInstitution:', error);
      throw error;
    }
  }

  /**
   * Get institutions by type
   */
  async getInstitutionsByType(type: string, options?: QueryOptions): Promise<Institution[]> {
    try {
      let query = this.liveClient
        .from('institutions')
        .select('*')
        .eq('type', type);

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
      this.logger.error('Error in getInstitutionsByType:', error);
      return [];
    }
  }

  /**
   * Search institutions by name
   */
  async searchInstitutionsByName(searchTerm: string, options?: QueryOptions): Promise<Institution[]> {
    try {
      let query = this.liveClient
        .from('institutions')
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
      this.logger.error('Error in searchInstitutionsByName:', error);
      return [];
    }
  }

  /**
   * Get institutions by location
   */
  async getInstitutionsByLocation(location: string, options?: QueryOptions): Promise<Institution[]> {
    try {
      let query = this.liveClient
        .from('institutions')
        .select('*')
        .eq('location', location);

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
      this.logger.error('Error in getInstitutionsByLocation:', error);
      return [];
    }
  }

  /**
   * Get or create institution
   */
  async getOrCreateInstitution(): Promise<string> {
    try {
      // First try to get the default institution
      const { data: existingInstitution, error: fetchError } = await this.stagingClient
        .from('institutions')
        .select('id')
        .eq('name', 'NSW Government')
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        this.logger.error('Error fetching institution:', fetchError);
        throw fetchError;
      }

      if (existingInstitution) {
        return existingInstitution.id;
      }

      // Create new institution if it doesn't exist
      const { data: newInstitution, error: insertError } = await this.stagingClient
        .from('institutions')
        .insert({
          name: 'NSW Government',
          slug: 'nsw-gov',
          description: 'New South Wales Government',
          website_url: 'https://www.nsw.gov.au',
          sync_status: 'pending',
          last_synced_at: null
        })
        .select('id')
        .single();

      if (insertError) {
        this.logger.error('Error creating institution:', insertError);
        throw insertError;
      }

      return newInstitution.id;
    } catch (error) {
      this.logger.error('Error in getOrCreateInstitution:', error);
      throw error;
    }
  }
} 