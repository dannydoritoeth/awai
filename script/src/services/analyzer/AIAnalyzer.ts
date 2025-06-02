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

import { OpenAI } from 'openai';
import { CapabilityAnalysisResult, TaxonomyAnalysisResult, capabilityAnalysisPrompt, taxonomyAnalysisPrompt, createCapabilityAnalysisPrompt } from './templates/capabilityAnalysis.js';
import { Logger } from '../../utils/logger.js';
import { JobDetails } from '../spider/types.js';
import { delay } from '../../utils/helpers.js';

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
  };
}

export class AIAnalyzer {
  private openai: OpenAI;
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

  constructor(
    private config: AIAnalyzerConfig,
    private logger: Logger
  ) {
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 30000;
    this.model = config.openaiModel || "gpt-4-0125-preview";
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
   * Analyzes a job description to extract capabilities
   */
  async analyzeJobDescription(content: string): Promise<CapabilityAnalysisResult> {
    try {
      const startTime = Date.now();
      
      this.logger.info('Starting capability analysis');

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: capabilityAnalysisPrompt
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

      const result = JSON.parse(responseContent) as CapabilityAnalysisResult;
      
      // Store the AI invocation
      if (this.config.storageService) {
        await this.config.storageService.storeAIInvocation({
          action_type: 'analyze_job_capabilities',
          model_provider: 'openai',
          model_name: this.model,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
          system_prompt: capabilityAnalysisPrompt,
          user_prompt: content,
          messages: [
            {
              role: "system",
              content: capabilityAnalysisPrompt
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
      }
      
      return result;
    } catch (error) {
      // Store the failed AI invocation
      if (this.config.storageService) {
        await this.config.storageService.storeAIInvocation({
          action_type: 'analyze_job_capabilities',
          model_provider: 'openai',
          model_name: this.model,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
          system_prompt: capabilityAnalysisPrompt,
          user_prompt: content,
          messages: [
            {
              role: "system",
              content: capabilityAnalysisPrompt
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
      }

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
   * Creates a taxonomy analysis of a job posting
   */
  async createJobSummary(content: string): Promise<TaxonomyAnalysisResult> {
    try {
      const startTime = Date.now();
      
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: taxonomyAnalysisPrompt
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

      const responseContent = completion.choices[0].message.content;
      if (!responseContent) {
        throw new Error('No content returned from OpenAI');
      }

      const result = JSON.parse(responseContent) as TaxonomyAnalysisResult;

      // Store the AI invocation
      if (this.config.storageService) {
        await this.config.storageService.storeAIInvocation({
          action_type: 'analyze_job_taxonomy',
          model_provider: 'openai',
          model_name: this.model,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
          system_prompt: taxonomyAnalysisPrompt,
          user_prompt: content,
          messages: [
            {
              role: "system",
              content: taxonomyAnalysisPrompt
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
      }

      return result;
    } catch (error) {
      // Store the failed AI invocation
      if (this.config.storageService) {
        await this.config.storageService.storeAIInvocation({
          action_type: 'analyze_job_taxonomy',
          model_provider: 'openai',
          model_name: this.model,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
          system_prompt: taxonomyAnalysisPrompt,
          user_prompt: content,
          messages: [
            {
              role: "system",
              content: taxonomyAnalysisPrompt
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
      }

      this.logger.error('Error creating job taxonomy:', error);
      throw error;
    }
  }

  /**
   * Analyze job capabilities and skills
   */
  async analyzeCapabilities(job: JobDetails): Promise<CapabilityAnalysisResult> {
    try {
      this.logger.info(`Analyzing capabilities for job ${job.id}`);

      if (!this.frameworkCapabilities || this.frameworkCapabilities.length === 0) {
        throw new Error('Framework capabilities not loaded. Please ensure initialize() is called first.');
      }

      // Create the prompt with the current framework capabilities
      const prompt = createCapabilityAnalysisPrompt(this.frameworkCapabilities);

      // Prepare the content for analysis
      const content = [
        `Job Title: ${job.title}`,
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

      this.logger.info('Job content prepared for analysis:', {
        title: job.title,
        contentLength: content.length,
        hasDescription: Boolean(job.description),
        responsibilitiesCount: job.responsibilities.length,
        requirementsCount: job.requirements.length,
        notesCount: job.notes.length,
        hasAboutUs: Boolean(job.aboutUs),
        frameworkCapabilitiesCount: this.frameworkCapabilities.length
      });

      const result = await this.retryOperation(
        () => this.analyzeJobDescription(content)
      );
      
      this.logger.info(`Capability analysis complete for job ${job.id}`, {
        capabilitiesFound: result.capabilities.length,
        skillsFound: result.skills.length,
        occupationalGroups: result.occupationalGroups,
        focusAreas: result.focusAreas
      });
      
      return result;
    } catch (error) {
      this.logger.error(`Error analyzing capabilities for job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Analyze job taxonomy
   */
  async analyzeTaxonomy(job: JobDetails): Promise<TaxonomyAnalysisResult> {
    try {
      this.logger.info(`Analyzing taxonomy for job: ${job.title}`);
      const result = await this.retryOperation(
        () => this.createJobSummary(job.description)
      );
      this.logger.info(`Taxonomy analysis complete for job ${job.id}`);
      return result;
    } catch (error) {
      this.logger.error(`Error analyzing taxonomy for job ${job.id}:`, error);
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
} 