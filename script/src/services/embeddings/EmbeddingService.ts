/**
 * @file EmbeddingService.ts
 * @description Part of NSW Government Jobs ETL Refactoring
 * 
 * Service for generating and managing embeddings for jobs, capabilities, and skills.
 * This service maintains the same embedding functionality as the current implementation
 * to ensure consistent results during refactoring.
 * 
 * @module services/embeddings
 * @see RefactorETL.md for the complete refactoring plan
 * 
 * @author AWAI Team
 * @version 1.0.0
 * @since 2024-02-06
 */

import { OpenAI } from 'openai';
import { EmbeddingConfig, EmbeddingResult, jobEmbeddingPrompt, capabilityEmbeddingPrompt, skillEmbeddingPrompt } from './templates/embeddingTemplates.js';
import { Logger } from '../../utils/logger.js';

export class EmbeddingService {
  private openai: OpenAI;
  private maxRetries: number;
  private retryDelay: number;

  constructor(
    private config: EmbeddingConfig,
    private logger: Logger
  ) {
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  /**
   * Generate embedding for job description
   */
  async generateJobEmbedding(description: string): Promise<EmbeddingResult> {
    try {
      this.logger.info('Generating job embedding');
      const vector = await this.generateEmbedding(description);
      return {
        vector,
        text: description,
        metadata: {
          source: 'job_description',
          timestamp: new Date().toISOString(),
          model: this.config.model
        }
      };
    } catch (error) {
      this.logger.error('Error generating job embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embedding for capability
   */
  async generateCapabilityEmbedding(description: string): Promise<EmbeddingResult> {
    try {
      this.logger.info('Generating capability embedding');
      const vector = await this.generateEmbedding(description);
      return {
        vector,
        text: description,
        metadata: {
          source: 'capability',
          timestamp: new Date().toISOString(),
          model: this.config.model
        }
      };
    } catch (error) {
      this.logger.error('Error generating capability embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embedding for skill
   */
  async generateSkillEmbedding(description: string): Promise<EmbeddingResult> {
    try {
      this.logger.info('Generating skill embedding');
      const vector = await this.generateEmbedding(description);
      return {
        vector,
        text: description,
        metadata: {
          source: 'skill',
          timestamp: new Date().toISOString(),
          model: this.config.model
        }
      };
    } catch (error) {
      this.logger.error('Error generating skill embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embedding vector from text
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const formattedText = await this.formatContentForEmbedding(text);
      return await this.createEmbedding(formattedText);
    } catch (error) {
      this.logger.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Format content for embedding generation
   */
  private async formatContentForEmbedding(text: string): Promise<string> {
    // Clean and normalize text
    const cleaned = text
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.,!?-]/g, '');

    // Truncate if needed
    return cleaned.length > this.config.maxTokens
      ? cleaned.substring(0, this.config.maxTokens)
      : cleaned;
  }

  /**
   * Creates the actual embedding vector using OpenAI's embedding model
   */
  private async createEmbedding(content: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: content
    });

    return response.data[0].embedding;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Nothing to clean up for OpenAI client
    this.logger.info('Successfully cleaned up embedding service');
  }
} 