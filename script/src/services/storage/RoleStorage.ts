/**
 * @file RoleStorage.ts
 * @description Handles all role-related database operations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../utils/logger.js';
import { JobDetails, Role, QueryOptions } from './types.js';
import { CompanyStorage } from './CompanyStorage.js';

export class RoleStorage {
  constructor(
    private stagingClient: SupabaseClient,
    private liveClient: SupabaseClient,
    private logger: Logger,
    private companies: CompanyStorage
  ) {}

  /**
   * Create a new role
   */
  async createRole(role: Omit<Role, 'id' | 'created_at' | 'updated_at'>): Promise<Role | null> {
    try {
      const { data, error } = await this.stagingClient
        .from('roles')
        .insert(role)
        .select()
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      this.logger.error('Error in createRole:', error);
      throw error;
    }
  }

  /**
   * Update an existing role
   */
  async updateRole(id: string, role: Partial<Role>): Promise<Role | null> {
    try {
      const { data, error } = await this.stagingClient
        .from('roles')
        .update(role)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      this.logger.error('Error in updateRole:', error);
      throw error;
    }
  }

  /**
   * Get a role by ID
   */
  async getRoleById(id: string): Promise<Role | null> {
    try {
      const { data, error } = await this.liveClient
        .from('roles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      this.logger.error('Error in getRoleById:', error);
      return null;
    }
  }

  /**
   * Get roles by filter criteria
   */
  async getRolesByFilter(filters: Record<string, any>, options?: QueryOptions): Promise<Role[]> {
    try {
      let query = this.liveClient
        .from('roles')
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
      this.logger.error('Error in getRolesByFilter:', error);
      return [];
    }
  }

  /**
   * Delete a role by ID
   */
  async deleteRole(id: string): Promise<void> {
    try {
      const { error } = await this.stagingClient
        .from('roles')
        .delete()
        .eq('id', id);

      if (error) throw error;

    } catch (error) {
      this.logger.error('Error in deleteRole:', error);
      throw error;
    }
  }

  /**
   * Get roles by name search
   */
  async searchRolesByName(searchTerm: string, options?: QueryOptions): Promise<Role[]> {
    try {
      let query = this.liveClient
        .from('roles')
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
      this.logger.error('Error in searchRolesByName:', error);
      return [];
    }
  }

  /**
   * Store role record in staging
   */
  async storeRoleRecord(role: { title: string; company_id: string; raw_data: any }): Promise<any[]> {
    try {
      // First check if role exists
      const { data: existingRole, error: fetchError } = await this.stagingClient
        .from('roles')
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
   * Get or create a role for a job
   */
  async getRoleByJobDetails(job: JobDetails): Promise<{ id: string; title: string } | null> {
    try {
      // First create/get the company
      const companyData = await this.companies.storeCompanyRecord({
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
   * Store role-taxonomy relationships
   */
  async storeRoleTaxonomies(roleTaxonomies: Array<{
    roleId: string;
    taxonomyId: string;
  }>): Promise<void> {
    try {
      this.logger.info(`Storing ${roleTaxonomies.length} role-taxonomy relationships`);

      // Process in batches of 100
      const batchSize = 100;
      for (let i = 0; i < roleTaxonomies.length; i += batchSize) {
        const batch = roleTaxonomies.slice(i, i + batchSize);
        
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
} 