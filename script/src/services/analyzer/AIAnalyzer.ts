/**
 * @file AIAnalyzer.ts
 * @description Part of NSW Government Jobs ETL Refactoring
 * 
 * AI analysis service for job descriptions, capabilities, and skills.
 * This service maintains the same analysis logic as the current implementation
 * to ensure consistent results during refactoring.
 * 
 * @module services/analyzer
 * @see RefactorETL.md for the complete refactoring plan
 * 
 * @author AWAI Team
 * @version 1.0.0
 * @since 2024-02-06
 * 
 * Dependencies:
 * - OpenAI API
 * - Job Analysis Templates
 * - Capability Analysis Templates
 */

import OpenAI from 'openai';
import { createHash } from 'crypto';
import { 
  CapabilityAnalysisResult, 
  createCapabilityAnalysisPrompt,
  LLMCapabilityAnalysisResult,
  TaxonomyAnalysisResult as TaxonomyResult
} from './templates/capabilityAnalysis.js';
import {
  createTaxonomyAnalysisPrompt,
  TaxonomyGroup
} from './templates/taxonomyAnalysis.js';
import { Logger } from '../../utils/logger.js';
import { JobDetails } from '../spider/types.js';
import { ProcessedJob } from '../storage/types.js';
import { delay } from '../../utils/helpers.js';
import { TestDataManager, AIModelInvocation } from '../../utils/TestDataManager.js';

export interface AIAnalyzerConfig {
  openaiApiKey: string;
  openaiModel?: string;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  temperature?: number;
  maxTokens?: number;
  storageService?: {
    storeAIInvocation: (invocation: {
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
    }) => Promise<void>;
    getSimilarGeneralRoles: (embedding: number[]) => Promise<Array<{ id: string; name: string; description: string; similarity: number }>>;
    storeGeneralRole: (role: {
      title: string;
      description: string;
      function_area: string;
      classification_level: string;
    }) => Promise<{ id: string }>;
    linkRoleToGeneralRole: (roleId: string, generalRoleId: string) => Promise<void>;
    getOrCreateGeneralRole: (roleTitle: string) => Promise<{ id: string }>;
    generalRoles: {
      getOrCreateGeneralRole: (roleTitle: string, description: string) => Promise<{ id: string }>;
    };
  };
}

export interface BatchTaxonomyAnalysisResult {
  roleTaxonomies: Array<{
    roleId: string;
    roleTitle: string;
    taxonomyIds: string[];
  }>;
}

export class AIAnalyzer {
  private openai: OpenAI;
  private testDataManager: TestDataManager;
  private maxRetries: number;
  private timeout: number;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private frameworkCapabilities: Array<{
    id: string;
    name: string;
    description: string;
    group_name: string;
  }> = [];

  private taxonomyGroups: Array<{
    id: string;
    name: string;
    description: string;
  }> = [];

  constructor(
    private config: AIAnalyzerConfig,
    private logger: Logger
  ) {
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    this.testDataManager = new TestDataManager();
    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 30000;
    this.model = config.openaiModel || "gpt-4-turbo-preview";
    this.temperature = config.temperature || 0;
    this.maxTokens = config.maxTokens || 2000;
    this.logger.info('AIAnalyzer initialized');
  }

  /**
   * Set the framework capabilities for use in analysis
   */
  async setFrameworkCapabilities(capabilities: Array<{
    id: string;
    name: string;
    description: string;
    group_name: string;
  }>): Promise<void> {
    this.frameworkCapabilities = capabilities;
    this.logger.info(`Set ${capabilities.length} framework capabilities for analysis`);
  }

  /**
   * Set the taxonomy groups for analysis
   */
  async setTaxonomyGroups(taxonomies: Array<{
    id: string;
    name: string;
    description: string;
  }>): Promise<void> {
    this.taxonomyGroups = taxonomies;
    this.logger.info(`Set ${taxonomies.length} taxonomy groups for analysis`);
  }

  /**
   * Load test data for a specific analysis task
   */
  private async loadTestData<T>(jobId: string, taskName: string): Promise<T | null> {
    try {
      if (!process.env.LOAD_TEST_SCENARIO) {
        return null;
      }

      const filename = `${jobId}-${taskName}.json`;
      const data = await this.testDataManager.loadTestData(filename);
      if (data) {
        this.logger.info(`Loaded test data for ${taskName} analysis of job ${jobId}`);
        return data as T;
      }
      return null;
    } catch (error) {
      this.logger.warn(`Failed to load test data for ${taskName} analysis:`, error);
      return null;
    }
  }

  /**
   * Save test data for a specific analysis task
   */
  private async saveTestData<T>(jobId: string, taskName: string, data: T): Promise<void> {
    try {
      if (process.env.LOAD_TEST_SCENARIO || process.env.SAVE_TEST_DATA !== 'true') {
        return;
      }

      const filename = `${jobId}-${taskName}.json`;
      await this.testDataManager.saveTestData(filename, data);
      this.logger.info(`Saved test data for ${taskName} analysis of job ${jobId}`);
    } catch (error) {
      this.logger.warn(`Failed to save test data for ${taskName} analysis:`, error);
    }
  }

  /**
   * Save AI invocation to both storage service and test data
   */
  private async saveAIInvocation(invocation: {
    action_type: string;
    model_provider: 'openai' | 'anthropic' | 'cohere';
    model_name: string;
    temperature?: number;
    max_tokens?: number;
    system_prompt?: string;
    user_prompt: string;
    messages?: any;
    response_text: string;
    response_metadata?: any;
    token_usage?: any;
    status: 'success' | 'error';
    error_message?: string;
    latency_ms?: number;
    jobId?: string;
  }): Promise<void> {
    try {
      const normalizedInvocation = {
        ...invocation,
        response_text: invocation.response_text || '',
        response_metadata: invocation.response_metadata || {},
        token_usage: invocation.token_usage || {},
        error_message: invocation.error_message || undefined,
        latency_ms: invocation.latency_ms || 0,
        model_provider: invocation.model_provider as 'openai' | 'anthropic' | 'cohere',
        status: invocation.status as 'success' | 'error'
      };

      // Save to storage service if configured
      if (this.config.storageService) {
        await this.config.storageService.storeAIInvocation(normalizedInvocation);
      }

      // Save to test data if enabled
      if (process.env.SAVE_TEST_DATA === 'true' && invocation.jobId) {
        const taskName = invocation.action_type.replace('analyze_', '');
        await this.saveTestData(invocation.jobId, taskName, {
          request: {
            action_type: invocation.action_type,
            model_name: invocation.model_name,
            system_prompt: invocation.system_prompt,
            user_prompt: invocation.user_prompt,
            messages: invocation.messages
          },
          response: {
            text: invocation.response_text,
            metadata: invocation.response_metadata,
            token_usage: invocation.token_usage
          },
          status: invocation.status,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      this.logger.error('Error saving AI invocation:', error);
    }
  }

  /**
   * Analyzes a job description to extract capabilities
   */
  async analyzeJobDescription(content: string, systemPrompt: string): Promise<LLMCapabilityAnalysisResult> {
    try {
      const startTime = Date.now();
      
      this.logger.info('Starting capability analysis');

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content
          }
        ],
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        response_format: { type: "json_object" }
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('No content returned from OpenAI');
      }

      const result = JSON.parse(responseContent) as LLMCapabilityAnalysisResult;
      
      // Store the AI invocation
      await this.saveAIInvocation({
        action_type: 'analyze_job_capabilities',
        model_provider: 'openai',
        model_name: this.model,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        system_prompt: systemPrompt,
        user_prompt: content,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content
          }
        ],
        response_text: responseContent,
        response_metadata: {
          model: completion.model,
          object: completion.object,
          created: completion.created,
          system_fingerprint: completion.system_fingerprint
        },
        token_usage: completion.usage,
        status: 'success',
        latency_ms: Date.now() - startTime
      });
      
      return result;
    } catch (error) {
      // Store the failed AI invocation
      await this.saveAIInvocation({
        action_type: 'analyze_job_capabilities',
        model_provider: 'openai',
        model_name: this.model,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        system_prompt: systemPrompt,
        user_prompt: content,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content
          }
        ],
        response_text: '',
        status: 'error',
        error_message: error instanceof Error ? error.message : String(error)
      });

      this.logger.error('Error analyzing job description:', {
        error,
        model: this.model,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
        content: content
      });
      throw error;
    }
  }

  /**
   * Maps the LLM capability analysis result to the final result with IDs
   */
  private mapCapabilityResult(llmResult: LLMCapabilityAnalysisResult): CapabilityAnalysisResult {
    // Create maps for looking up IDs by name
    const capabilityMap = new Map(this.frameworkCapabilities.map(c => [c.name, c.id]));
    const taxonomyMap = new Map(this.taxonomyGroups.map(t => [t.name, t.id]));

    // Map capabilities
    const capabilities = (llmResult.capabilities || []).map(cap => ({
      id: capabilityMap.get(cap.name) || '',
      name: cap.name,
      level: cap.level,
      description: cap.description,
      relevance: cap.relevance
    })).filter(cap => cap.id); // Only keep capabilities we found IDs for

    // Map taxonomies
    const taxonomies = (llmResult.taxonomies || []).map(tax => ({
      id: taxonomyMap.get(tax.name) || '',
      name: tax.name
    })).filter(tax => tax.id); // Only keep taxonomies we found IDs for

    // Map skills (no IDs yet, will be generated when stored)
    const skills = (llmResult.skills || []).map(skill => ({
      id: '', // Will be generated when stored
      name: skill.name,
      description: skill.description,
      category: skill.category
    }));

    // Return mapped result
    return {
      capabilities,
      occupationalGroups: llmResult.occupationalGroups || [],
      focusAreas: llmResult.focusAreas || [],
      skills,
      taxonomies,
      generalRole: llmResult.generalRole ? {
        id: '', // Will be handled by the calling code
        name: llmResult.generalRole.name,
        title: llmResult.generalRole.title,
        description: llmResult.generalRole.description,
        confidence: llmResult.generalRole.confidence,
        isNewRole: llmResult.generalRole.isNewRole
      } : {
        id: '',
        name: '',
        title: '',
        description: '',
        confidence: 0,
        isNewRole: true
      }
    };
  }

  /**
   * Analyze job capabilities and skills
   */
  async analyzeCapabilities(job: JobDetails): Promise<CapabilityAnalysisResult> {
    const jobId = job.id;
    //  || job.roleId || createHash('sha256')
    //   .update(`${job.title ?? ''}-${job.agency ?? ''}`)
    //   .digest('hex')
    //   .substring(0, 8);

    try {
      this.logger.info(`Analyzing capabilities for job ${jobId}`);

      if (!this.frameworkCapabilities || this.frameworkCapabilities.length === 0) {
        throw new Error('Framework capabilities not loaded. Please ensure initialize() is called first.');
      }

      if (!this.taxonomyGroups || this.taxonomyGroups.length === 0) {
        throw new Error('Taxonomy groups not loaded. Please ensure setTaxonomyGroups() is called first.');
      }

      // Try to load from test data first
      const savedData = await this.testDataManager.loadCapabilityAnalysis(jobId);
      if (savedData) {
        this.logger.info(`Using saved capability analysis for job ${jobId}`);
        const result = this.mapCapabilityResult(savedData);
        await this.linkGeneralRole(result, job, jobId);
        return result;
      }

      // Get similar general roles if we have a storage service
      let similarGeneralRoles: Array<{ id: string; name: string; description: string; similarity: number }> = [];
      if (this.config.storageService && job.embedding) {
        try {
          similarGeneralRoles = await this.config.storageService.getSimilarGeneralRoles(job.embedding);
        } catch (error) {
          this.logger.warn('Failed to get similar general roles:', error);
          // Continue with empty similar roles
        }
      }

      // Perform AI analysis
      const llmResult = await this.performCapabilityAnalysis(job, similarGeneralRoles);

      // Save the analysis result
      await this.testDataManager.saveCapabilityAnalysis(jobId, llmResult);

      // Map the LLM result to the final result with IDs
      const result = this.mapCapabilityResult(llmResult);
      
      // Link the general role
      await this.linkGeneralRole(result, job, jobId);
      
      this.logger.info(`Capability analysis complete for job ${jobId}`, {
        capabilitiesFound: result.capabilities.length,
        skillsFound: result.skills.length,
        occupationalGroups: result.occupationalGroups,
        focusAreas: result.focusAreas
      });
      
      return result;
    } catch (error) {
      this.logger.error(`Error analyzing capabilities for job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Perform AI analysis for job capabilities
   */
  private async performCapabilityAnalysis(
    job: JobDetails, 
    similarGeneralRoles: Array<{ id: string; name: string; description: string; similarity: number }>
  ): Promise<LLMCapabilityAnalysisResult> {
    // Create the prompt with the current framework capabilities, taxonomy groups and similar roles
    const prompt = createCapabilityAnalysisPrompt(
      this.frameworkCapabilities, 
      this.taxonomyGroups,
      similarGeneralRoles
    );

    // Prepare the content for analysis
    const content = [
      `Job Title: ${job.title}`,
      `Agency: ${job.agency}`,
      `Job Type: ${job.jobType}`,
      `Location: ${job.location}`,
      `Description:`,
      job.description,
      `Responsibilities:`,
      ...(job.responsibilities || []).map((responsibility) => `- ${responsibility}`),
      `Requirements:`,
      ...(job.requirements || []).map((requirement) => `- ${requirement}`),
      `Notes:`,
      ...(job.notes || []).map((note) => `- ${note}`)
    ].join('\n');

    this.logger.info('Job content prepared for analysis:', {
      title: job.title,
      contentLength: content.length,
      hasDescription: Boolean(job.description),
      responsibilitiesCount: job.responsibilities?.length || 0,
      requirementsCount: job.requirements?.length || 0,
      notesCount: job.notes?.length || 0,
      hasAboutUs: Boolean(job.aboutUs),
      frameworkCapabilitiesCount: this.frameworkCapabilities.length
    });

    return this.retryOperation(
      () => this.analyzeJobDescription(content, prompt)
    );
  }

  /**
   * Link general role to job
   */
  private async linkGeneralRole(
    result: CapabilityAnalysisResult, 
    job: JobDetails,
    jobId: string
  ): Promise<void> {
    const generalRole = result?.generalRole;
    this.logger.info(`Linking general role ${JSON.stringify(generalRole)}`);
    if (generalRole?.title && this.config.storageService?.generalRoles) {
      try {
        const storedRole = await this.config.storageService.generalRoles.getOrCreateGeneralRole(
          generalRole.title,
          generalRole.description || `General role for ${generalRole.title}`
        );
        
        if (storedRole?.id) {  // Add null check
          // Update the result with the stored role ID
          generalRole.id = storedRole.id;
          
          // Link the role to the general role
          if (job.roleId) {
            await this.config.storageService.linkRoleToGeneralRole(job.roleId, storedRole.id);
            this.logger.info(`Linked role ${job.roleId} to general role ${storedRole.id}`);
          } else {
            this.logger.warn(`No roleId found for job ${jobId}, cannot link to general role ${storedRole.id}`);
          }
          
          this.logger.info(`Stored/retrieved general role: ${storedRole.id}`);
        }
      } catch (error) {
        this.logger.warn('Failed to store/retrieve general role:', error);
      }
    } else if (generalRole && typeof generalRole.id === 'string' && generalRole.id.length > 0 && job.roleId) {
      // If we matched an existing general role, link it
      try {
        await this.config.storageService.linkRoleToGeneralRole(job.roleId, generalRole.id);
        this.logger.info(`Linked role ${job.roleId} to existing general role ${generalRole.id}`);
      } catch (error) {
        this.logger.warn('Failed to link role to general role:', error);
      }
    }
  }

  /**
   * Create job summary and taxonomy analysis
   */
  async createJobSummary(jobDescription: string, jobId: string): Promise<TaxonomyResult> {
    try {
      // Try to load from test data first
      const savedData = await this.testDataManager.loadTaxonomyAnalysis(jobId);
      if (savedData) {
        this.logger.info(`Using saved taxonomy analysis for job ${jobId}`);
        return savedData;
      }

      if (!this.taxonomyGroups || this.taxonomyGroups.length === 0) {
        throw new Error('Taxonomy groups not loaded. Please ensure setTaxonomyGroups() is called first.');
      }

      // Perform AI analysis
      const result = await this.performTaxonomyAnalysis(jobDescription);

      // Save the analysis result
      await this.testDataManager.saveTaxonomyAnalysis(jobId, result);

      return result;
    } catch (error) {
      this.logger.error('Error in createJobSummary:', error);
      throw error;
    }
  }

  /**
   * Perform AI analysis for job taxonomy
   */
  private async performTaxonomyAnalysis(jobDescription: string): Promise<TaxonomyResult> {
    const systemPromptText = createTaxonomyAnalysisPrompt(this.taxonomyGroups);
    const userContent = jobDescription;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "system",
          content: systemPromptText
        },
        {
          role: "user",
          content: userContent
        }
      ],
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      response_format: { type: "json_object" }
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No content returned from OpenAI');
    }

    return JSON.parse(responseContent) as TaxonomyResult;
  }

  /**
   * Analyze job taxonomy
   */
  async analyzeTaxonomy(job: JobDetails & { roleId: string }): Promise<TaxonomyResult> {
    try {
      this.logger.info(`Analyzing taxonomy for job: ${job.title}`);
      
      // Prepare the job content
      const jobContent = [
        `Title: ${job.title}`,
        `Agency: ${job.agency}`,
        `Job Type: ${job.jobType}`,
        `Location: ${job.location}`,
        `Description:`,
        job.description,
        `Responsibilities:`,
        ...job.responsibilities.map(r => `- ${r}`),
        `Requirements:`,
        ...job.requirements.map(r => `- ${r}`),
        `Notes:`,
        ...job.notes.map(n => `- ${n}`),
        `About Us:`,
        job.aboutUs
      ].filter(Boolean).join('\n\n');

      const result = await this.retryOperation(
        () => this.createJobSummary(jobContent, job.roleId)
      );
      this.logger.info(`Taxonomy analysis complete for job ${job.id}`);
      return result;
    } catch (error) {
      this.logger.error(`Error analyzing taxonomy for job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Analyze taxonomies for a batch of roles
   */
  async analyzeBatchTaxonomies(roles: Array<{ id: string; title: string }>): Promise<BatchTaxonomyAnalysisResult> {
    try {
      const startTime = Date.now();
      this.logger.info(`Analyzing taxonomies for ${roles.length} roles`);

      if (!this.taxonomyGroups || this.taxonomyGroups.length === 0) {
        throw new Error('Taxonomy groups not loaded. Please ensure setTaxonomyGroups() is called first.');
      }

      // Create the prompt with the current taxonomy groups
      const taxonomyData = this.taxonomyGroups.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description
      }));
      const systemPromptText = createTaxonomyAnalysisPrompt(taxonomyData);

      // Prepare the content for analysis
      const content = JSON.stringify({
        roles: roles.map(r => ({
          id: r.id,
          title: r.title
        }))
      }, null, 2);

      try {
        const completion = await this.openai.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: "system",
              content: systemPromptText
            },
            {
              role: "user",
              content
            }
          ],
          temperature: this.temperature,
          max_tokens: this.maxTokens,
          response_format: { type: "json_object" }
        });

        const responseContent = completion.choices[0]?.message?.content;
        if (!responseContent) {
          throw new Error('No content returned from OpenAI');
        }

        const result = JSON.parse(responseContent) as BatchTaxonomyAnalysisResult;

        // Store the AI invocation
        await this.saveAIInvocation({
          action_type: 'analyze_batch_taxonomies',
          model_provider: 'openai',
          model_name: this.model,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
          system_prompt: systemPromptText,
          user_prompt: content,
          messages: [
            {
              role: "system",
              content: systemPromptText
            },
            {
              role: "user",
              content
            }
          ],
          response_text: responseContent,
          response_metadata: {
            model: completion.model,
            object: completion.object,
            created: completion.created,
            system_fingerprint: completion.system_fingerprint
          },
          token_usage: completion.usage,
          status: 'success',
          latency_ms: Date.now() - startTime
        });

        this.logger.info('Taxonomy analysis complete', {
          rolesAnalyzed: roles.length,
          taxonomiesAssigned: result.roleTaxonomies.reduce((sum, rt) => sum + rt.taxonomyIds.length, 0)
        });

        return result;
      } catch (error) {
        // Log the error with the prompts for debugging
        this.logger.error('OpenAI API error:', {
          error,
          systemPrompt: systemPromptText,
          userPrompt: content
        });
        throw error;
      }
    } catch (error) {
      this.logger.error('Error in batch taxonomy analysis:', error);
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Nothing to clean up for OpenAI client
    this.logger.info('Successfully cleaned up AI analyzer service');
  }

  /**
   * Retry an operation with exponential backoff
   */
  private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    const maxRetries = this.config.maxRetries || 3;
    const retryDelay = this.config.retryDelay || 1000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries) {
          const backoff = retryDelay * Math.pow(2, attempt - 1);
          this.logger.warn(`Retry attempt ${attempt} failed, waiting ${backoff}ms before next attempt`);
          await delay(backoff);
        }
      }
    }
    
    throw new Error('Operation failed after all retry attempts');
  }

  /**
   * Analyze job details using OpenAI
   */
  async analyzeJob(jobDetails: JobDetails): Promise<CapabilityAnalysisResult> {
    try {
      this.logger.info('Analyzing job:', jobDetails);
      const prompt = this.buildJobAnalysisPrompt(jobDetails);
      // Use roleId if available, otherwise generate a hash from the job title and agency
      const jobId = jobDetails.roleId || 
        createHash('sha256')
          .update(`${jobDetails.title || ''}-${jobDetails.agency || ''}`)
          .digest('hex')
          .substring(0, 8);

      // Try to load from test scenario first if enabled
      if (process.env.LOAD_TEST_SCENARIO) {
        const savedInvocation = await this.testDataManager.loadAIInvocation({
          action_type: 'analyze_job_capabilities',
          model_name: this.config.openaiModel || 'gpt-3.5-turbo',
          user_prompt: prompt,
          jobId
        });

        if (savedInvocation?.response_text) {
          this.logger.info('Using saved AI invocation from test scenario');
          return JSON.parse(savedInvocation.response_text);
        }
        throw new Error('Test scenario enabled but no saved AI invocation found');
      }

      // If not in test scenario mode, try to load from test data if enabled
      if (!process.env.LOAD_TEST_SCENARIO && process.env.SAVE_TEST_DATA === 'true') {
        const savedInvocation = await this.testDataManager.loadAIInvocation({
          action_type: 'analyze_job_capabilities',
          model_name: this.config.openaiModel || 'gpt-3.5-turbo',
          user_prompt: prompt,
          jobId
        });

        if (savedInvocation?.response_text) {
          this.logger.info('Using saved AI invocation from test data');
          return JSON.parse(savedInvocation.response_text);
        }
      }

      // Make the actual API call
      const response = await this.openai.chat.completions.create({
        model: this.config.openaiModel || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a job analysis expert. Analyze the job details and extract capabilities, skills, and other relevant information.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 1000
      });

      if (!response.choices || response.choices.length === 0) {
        throw new Error('No choices in OpenAI response');
      }

      const firstChoice = response.choices[0];
      if (!firstChoice.message?.content) {
        throw new Error('No content in OpenAI response');
      }

      const result = JSON.parse(firstChoice.message.content) as CapabilityAnalysisResult;

      // Save to test data if enabled
      if (!process.env.LOAD_TEST_SCENARIO && process.env.SAVE_TEST_DATA === 'true') {
        const invocation: AIModelInvocation = {
          action_type: 'analyze_job_capabilities',
          model_provider: 'openai',
          model_name: this.config.openaiModel || 'gpt-3.5-turbo',
          temperature: this.config.temperature || 0.7,
          max_tokens: this.config.maxTokens || 1000,
          user_prompt: prompt,
          response_text: firstChoice.message.content,
          response_metadata: {
            model: response.model,
            object: response.object,
            created: response.created,
            system_fingerprint: response.system_fingerprint
          },
          status: 'success',
          latency_ms: 0,
          jobId
        };

        // Only add token_usage if it exists
        if (response.usage) {
          invocation.token_usage = response.usage;
        }

        await this.testDataManager.saveAIInvocation(invocation);
      }

      return result;
    } catch (error) {
      this.logger.error('Error analyzing job:', error);
      throw error;
    }
  }

  /**
   * Build the prompt for job analysis
   */
  private buildJobAnalysisPrompt(jobDetails: JobDetails): string {
    return `
Please analyze the following job details and extract key information:

Title: ${jobDetails.title}
Agency: ${jobDetails.agency}
Description: ${jobDetails.description}

Please provide the following in JSON format:
1. Required capabilities with levels and behavioral indicators
2. Technical and soft skills
3. Occupational groups and focus areas
4. General role classification

The response should match this TypeScript type:

interface CapabilityAnalysisResult {
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
  occupationalGroups: string[];
  focusAreas: string[];
  generalRole: {
    title: string;
    description: string;
    confidence: number;
  };
}
`;
  }
} 