/**
 * @file GeneralRoleStorage.ts
 * @description Handles all general role-related database operations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../utils/logger.js';

export interface GeneralRoleData {
  id?: string;
  title: string;
  description: string;
  function_area: string;
  classification_level: string;
  raw_data?: any;
}

export interface GeneralRoleRecord {
  id: string;
  title: string;
  description: string;
  function_area: string;
  classification_level: string;
  raw_data?: any;
  sync_status: string;
  last_synced_at: string | null;
}

export class GeneralRoleStorage {
  constructor(
    private stagingClient: SupabaseClient,
    private liveClient: SupabaseClient,
    private logger: Logger
  ) {}

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
  async storeGeneralRole(role: GeneralRoleData): Promise<{ id: string }> {
    try {
      const roleData = {
        title: role.title,
        description: role.description,
        function_area: role.function_area,
        classification_level: role.classification_level,
        sync_status: 'pending',
        last_synced_at: null
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
        .update({ 
          general_role_id: generalRoleId,
          sync_status: 'pending',
          last_synced_at: null
        })
        .eq('id', roleId);

      if (error) throw error;
      this.logger.info(`Successfully linked role ${roleId} to general role ${generalRoleId}`);
    } catch (error) {
      this.logger.error('Error linking role to general role:', error);
      throw error;
    }
  }

  /**
   * Get or create a general role by title
   */
  async getOrCreateGeneralRole(title: string): Promise<{ id: string }> {
    try {
      // Check if role with same title exists
      const { data: existingRole, error: checkError } = await this.stagingClient
        .from('general_roles')
        .select('id')
        .eq('title', title)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') throw checkError;

      if (existingRole) {
        return existingRole;
      }

      // Create new role if it doesn't exist
      const roleData = {
        title: title,
        description: `General role for ${title}`,
        function_area: 'Unknown',
        classification_level: 'Unknown',
        sync_status: 'pending',
        last_synced_at: null
      };

      const { data, error } = await this.stagingClient
        .from('general_roles')
        .insert(roleData)
        .select('id')
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      this.logger.error('Error in getOrCreateGeneralRole:', error);
      throw error;
    }
  }

  /**
   * Get a general role by ID
   */
  async getGeneralRoleById(id: string): Promise<GeneralRoleRecord | null> {
    try {
      const { data, error } = await this.stagingClient
        .from('general_roles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      this.logger.error('Error getting general role:', error);
      throw error;
    }
  }

  /**
   * Get a general role by title
   */
  async getGeneralRoleByTitle(title: string): Promise<GeneralRoleRecord | null> {
    try {
      const { data, error } = await this.stagingClient
        .from('general_roles')
        .select('*')
        .eq('title', title)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      this.logger.error('Error getting general role by title:', error);
      throw error;
    }
  }
} 