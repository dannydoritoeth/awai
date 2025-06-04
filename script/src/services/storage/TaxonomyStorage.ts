/**
 * @file TaxonomyStorage.ts
 * @description Handles all taxonomy-related database operations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../utils/logger.js';
import { Taxonomy, QueryOptions } from './types.js';

export class TaxonomyStorage {
  constructor(
    private stagingClient: SupabaseClient,
    private liveClient: SupabaseClient,
    private logger: Logger
  ) {}

  /**
   * Create a new taxonomy
   */
  async createTaxonomy(taxonomy: Omit<Taxonomy, 'id' | 'created_at' | 'updated_at'>): Promise<Taxonomy | null> {
    try {
      const { data, error } = await this.stagingClient
        .from('taxonomies')
        .insert(taxonomy)
        .select()
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      this.logger.error('Error in createTaxonomy:', error);
      throw error;
    }
  }

  /**
   * Update an existing taxonomy
   */
  async updateTaxonomy(id: string, taxonomy: Partial<Taxonomy>): Promise<Taxonomy | null> {
    try {
      const { data, error } = await this.stagingClient
        .from('taxonomies')
        .update(taxonomy)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      this.logger.error('Error in updateTaxonomy:', error);
      throw error;
    }
  }

  /**
   * Get a taxonomy by ID
   */
  async getTaxonomyById(id: string): Promise<Taxonomy | null> {
    try {
      const { data, error } = await this.liveClient
        .from('taxonomies')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      this.logger.error('Error in getTaxonomyById:', error);
      return null;
    }
  }

  /**
   * Get taxonomies by filter criteria
   */
  async getTaxonomiesByFilter(filters: Record<string, any>, options?: QueryOptions): Promise<Taxonomy[]> {
    try {
      let query = this.liveClient
        .from('taxonomies')
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
      this.logger.error('Error in getTaxonomiesByFilter:', error);
      return [];
    }
  }

  /**
   * Delete a taxonomy by ID
   */
  async deleteTaxonomy(id: string): Promise<void> {
    try {
      const { error } = await this.stagingClient
        .from('taxonomies')
        .delete()
        .eq('id', id);

      if (error) throw error;

    } catch (error) {
      this.logger.error('Error in deleteTaxonomy:', error);
      throw error;
    }
  }

  /**
   * Get taxonomies by type
   */
  async getTaxonomiesByType(type: string, options?: QueryOptions): Promise<Taxonomy[]> {
    try {
      let query = this.liveClient
        .from('taxonomies')
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
      this.logger.error('Error in getTaxonomiesByType:', error);
      return [];
    }
  }

  /**
   * Get child taxonomies by parent ID
   */
  async getChildTaxonomies(parentId: string, options?: QueryOptions): Promise<Taxonomy[]> {
    try {
      let query = this.liveClient
        .from('taxonomies')
        .select('*')
        .eq('parent_id', parentId);

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
      this.logger.error('Error in getChildTaxonomies:', error);
      return [];
    }
  }

  /**
   * Search taxonomies by name
   */
  async searchTaxonomiesByName(searchTerm: string, options?: QueryOptions): Promise<Taxonomy[]> {
    try {
      let query = this.liveClient
        .from('taxonomies')
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
      this.logger.error('Error in searchTaxonomiesByName:', error);
      return [];
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
} 