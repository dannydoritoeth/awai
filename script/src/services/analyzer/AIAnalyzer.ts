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
import { CapabilityAnalysisResult, TaxonomyAnalysisResult, capabilityAnalysisPrompt, taxonomyAnalysisPrompt } from './templates/capabilityAnalysis.js';
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
}

export class AIAnalyzer {
  private openai: OpenAI;
  private maxRetries: number;
  private timeout: number;
  private model: string;
  private temperature: number;
  private maxTokens: number;

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
  }

  /**
   * Analyzes a job description to extract capabilities
   */
  async analyzeJobDescription(content: string): Promise<CapabilityAnalysisResult> {
    try {
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

      const result = JSON.parse(completion.choices[0].message.content || '{}');
      return result as CapabilityAnalysisResult;
    } catch (error) {
      this.logger.error('Error analyzing job description:', error);
      throw error;
    }
  }

  /**
   * Creates a taxonomy analysis of a job posting
   */
  async createJobSummary(content: string): Promise<TaxonomyAnalysisResult> {
    try {
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

      const result = JSON.parse(completion.choices[0].message.content || '{}');
      return result as TaxonomyAnalysisResult;
    } catch (error) {
      this.logger.error('Error creating job taxonomy:', error);
      throw error;
    }
  }

  /**
   * Analyze job capabilities and skills
   */
  async analyzeCapabilities(job: JobDetails): Promise<CapabilityAnalysisResult> {
    try {
      this.logger.info(`Analyzing capabilities for job: ${job.title}`);
      const result = await this.retryOperation(
        () => this.analyzeJobDescription(job.description)
      );
      this.logger.info(`Capability analysis complete for job ${job.id}`);
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
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.config.maxRetries) {
          const backoff = this.config.retryDelay * Math.pow(2, attempt - 1);
          this.logger.warn(`Retry attempt ${attempt} failed, waiting ${backoff}ms before next attempt`);
          await delay(backoff);
        }
      }
    }
    
    throw new Error('Operation failed after all retry attempts');
  }
} 