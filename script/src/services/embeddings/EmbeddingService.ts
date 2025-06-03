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

import OpenAI from 'openai';
import { EmbeddingConfig, EmbeddingResult, jobEmbeddingPrompt, capabilityEmbeddingPrompt, skillEmbeddingPrompt } from './templates/embeddingTemplates.js';
import { Logger } from '../../utils/logger.js';
import { TestDataManager } from '../../utils/TestDataManager.js';

export class EmbeddingService {
  private openai: OpenAI;
  private testDataManager: TestDataManager;
  private maxRetries: number;
  private retryDelay: number;

  constructor(
    private config: EmbeddingConfig,
    private logger: Logger
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.testDataManager = new TestDataManager();
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  /**
   * Generate embedding for text
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      // First try to load from test data if SAVE_TEST_DATA is true
      if (process.env.SAVE_TEST_DATA === 'true') {
        const savedEmbedding = await this.testDataManager.loadEmbedding(text);
        if (savedEmbedding) {
          this.logger.info('Using saved embedding from test data');
          return savedEmbedding.vector;
        }
      }

      // Generate new embedding
      const response = await this.openai.embeddings.create({
        model: this.config.model,
        input: text
      });

      const vector = response.data[0].embedding;

      // Save to test data if enabled
      if (process.env.SAVE_TEST_DATA === 'true') {
        await this.testDataManager.saveEmbedding(text, {
          vector,
          text,
          metadata: {
            source: 'openai',
            timestamp: new Date().toISOString(),
            model: this.config.model
          }
        });
      }

      return vector;
    } catch (error) {
      this.logger.error('Error generating embedding:', error);
      throw error;
    }
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
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Nothing to clean up for OpenAI client
    this.logger.info('Successfully cleaned up embedding service');
  }
} 