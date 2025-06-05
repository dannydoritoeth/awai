/**
 * @file SkillStorage.ts
 * @description Handles all skill-related database operations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../utils/logger.js';
import { Skill, ProcessedJob, QueryOptions, CompanyRecord } from './types.js';
import { CompanyStorage } from './CompanyStorage.js';

export class SkillStorage {
  constructor(
    private stagingClient: SupabaseClient,
    private liveClient: SupabaseClient,
    private logger: Logger,
    private companies: CompanyStorage
  ) {}

  /**
   * Get or create a company record
   */
  private async getOrCreateCompany(job: ProcessedJob): Promise<CompanyRecord> {
    return await this.companies.getOrCreateCompany({
      name: job.jobDetails.agency || 'NSW Government',
      description: job.jobDetails.aboutUs || '',
      website: '',
      raw_data: job.jobDetails
    });
  }

  /**
   * Store a single skill record
   */
  async storeSkillRecord(skill: { 
    name: string; 
    description?: string; 
    category?: string; 
    text?: string 
  }, companyId: string): Promise<{ id: string; name: string }> {
    try {
      // First try to get existing skill
      const { data: existingSkill, error: fetchError } = await this.stagingClient
        .from('skills')
        .select('id, name')
        .eq('name', skill.name || skill.text)
        .eq('company_id', companyId)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        this.logger.error('Error fetching skill:', fetchError);
        throw fetchError;
      }

      // If skill exists, return it
      if (existingSkill) {
        return existingSkill;
      }

      // Create new skill
      const { data: newSkill, error: createError } = await this.stagingClient
        .from('skills')
        .insert({
          name: skill.name || skill.text,
          description: skill.description || '',
          category: skill.category || 'general',
          company_id: companyId,
          sync_status: 'pending',
          last_synced_at: null
        })
        .select('id, name')
        .single();

      if (createError) {
        this.logger.error('Error creating skill:', createError);
        throw createError;
      }

      if (!newSkill) {
        throw new Error('No data returned after skill creation');
      }

      return newSkill;
    } catch (error) {
      this.logger.error('Error in storeSkillRecord:', error);
      throw error;
    }
  }

  /**
   * Link a skill to a role
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

      if (error) {
        this.logger.error('Error linking role and skill:', error);
        throw error;
      }
    } catch (error) {
      this.logger.error('Error in linkRoleSkill:', error);
      throw error;
    }
  }

  /**
   * Store multiple skill records for a job
   */
  async storeSkillRecords(job: ProcessedJob, skills: Array<{ 
    name: string; 
    description?: string; 
    category?: string; 
    text?: string 
  }>): Promise<void> {
    try {
      // Get or create company first
      const company = await this.getOrCreateCompany(job);
      this.logger.info(`Using company ID ${company.id} for skills of job ${job.jobDetails.id}`);

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

      // Store each skill and link to role
      for (const skill of skills) {
        try {
          // Store skill
          const skillRecord = await this.storeSkillRecord(skill, company.id);
          
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
   * Create a new skill
   */
  async createSkill(skill: Omit<Skill, 'id' | 'created_at' | 'updated_at'>): Promise<Skill | null> {
    try {
      const { data, error } = await this.stagingClient
        .from('skills')
        .insert(skill)
        .select()
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      this.logger.error('Error in createSkill:', error);
      throw error;
    }
  }

  /**
   * Update an existing skill
   */
  async updateSkill(id: string, skill: Partial<Skill>): Promise<Skill | null> {
    try {
      const { data, error } = await this.stagingClient
        .from('skills')
        .update(skill)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      this.logger.error('Error in updateSkill:', error);
      throw error;
    }
  }

  /**
   * Get a skill by ID
   */
  async getSkillById(id: string): Promise<Skill | null> {
    try {
      const { data, error } = await this.liveClient
        .from('skills')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      this.logger.error('Error in getSkillById:', error);
      return null;
    }
  }

  /**
   * Get skills by filter criteria
   */
  async getSkillsByFilter(filters: Record<string, any>, options?: QueryOptions): Promise<Skill[]> {
    try {
      let query = this.liveClient
        .from('skills')
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
      this.logger.error('Error in getSkillsByFilter:', error);
      return [];
    }
  }

  /**
   * Delete a skill by ID
   */
  async deleteSkill(id: string): Promise<void> {
    try {
      const { error } = await this.stagingClient
        .from('skills')
        .delete()
        .eq('id', id);

      if (error) throw error;

    } catch (error) {
      this.logger.error('Error in deleteSkill:', error);
      throw error;
    }
  }

  /**
   * Get skills by category
   */
  async getSkillsByCategory(category: string, options?: QueryOptions): Promise<Skill[]> {
    try {
      let query = this.liveClient
        .from('skills')
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
      this.logger.error('Error in getSkillsByCategory:', error);
      return [];
    }
  }

  /**
   * Search skills by name
   */
  async searchSkillsByName(searchTerm: string, options?: QueryOptions): Promise<Skill[]> {
    try {
      let query = this.liveClient
        .from('skills')
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
      this.logger.error('Error in searchSkillsByName:', error);
      return [];
    }
  }
} 