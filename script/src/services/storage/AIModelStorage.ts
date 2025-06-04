/**
 * @file AIModelStorage.ts
 * @description Handles all AI model-related database operations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../utils/logger.js';
import { AIModel, QueryOptions } from './types.js';

export class AIModelStorage {
  constructor(
    private stagingClient: SupabaseClient,
    private liveClient: SupabaseClient,
    private logger: Logger
  ) {}

  /**
   * Create a new AI model
   */
  async createAIModel(model: Omit<AIModel, 'id' | 'created_at' | 'updated_at'>): Promise<AIModel | null> {
    try {
      const { data, error } = await this.stagingClient
        .from('ai_models')
        .insert(model)
        .select()
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      this.logger.error('Error in createAIModel:', error);
      throw error;
    }
  }

  /**
   * Update an existing AI model
   */
  async updateAIModel(id: string, model: Partial<AIModel>): Promise<AIModel | null> {
    try {
      const { data, error } = await this.stagingClient
        .from('ai_models')
        .update(model)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      this.logger.error('Error in updateAIModel:', error);
      throw error;
    }
  }

  /**
   * Get an AI model by ID
   */
  async getAIModelById(id: string): Promise<AIModel | null> {
    try {
      const { data, error } = await this.liveClient
        .from('ai_models')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      this.logger.error('Error in getAIModelById:', error);
      return null;
    }
  }

  /**
   * Get AI models by filter criteria
   */
  async getAIModelsByFilter(filters: Record<string, any>, options?: QueryOptions): Promise<AIModel[]> {
    try {
      let query = this.liveClient
        .from('ai_models')
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
      this.logger.error('Error in getAIModelsByFilter:', error);
      return [];
    }
  }

  /**
   * Delete an AI model by ID
   */
  async deleteAIModel(id: string): Promise<void> {
    try {
      const { error } = await this.stagingClient
        .from('ai_models')
        .delete()
        .eq('id', id);

      if (error) throw error;

    } catch (error) {
      this.logger.error('Error in deleteAIModel:', error);
      throw error;
    }
  }

  /**
   * Get AI models by provider
   */
  async getAIModelsByProvider(provider: string, options?: QueryOptions): Promise<AIModel[]> {
    try {
      let query = this.liveClient
        .from('ai_models')
        .select('*')
        .eq('provider', provider);

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
      this.logger.error('Error in getAIModelsByProvider:', error);
      return [];
    }
  }

  /**
   * Get AI models by capability
   */
  async getAIModelsByCapability(capability: string, options?: QueryOptions): Promise<AIModel[]> {
    try {
      let query = this.liveClient
        .from('ai_models')
        .select('*')
        .contains('capabilities', [capability]);

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
      this.logger.error('Error in getAIModelsByCapability:', error);
      return [];
    }
  }

  /**
   * Search AI models by name
   */
  async searchAIModelsByName(searchTerm: string, options?: QueryOptions): Promise<AIModel[]> {
    try {
      let query = this.liveClient
        .from('ai_models')
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
      this.logger.error('Error in searchAIModelsByName:', error);
      return [];
    }
  }

  /**
   * Store AI model invocation record
   */
  async storeAIInvocation(invocation: {
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
      this.logger.error('Error storing AI invocation:', error);
      throw error;
    }
  }
} 