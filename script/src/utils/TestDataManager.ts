/**
 * @file TestDataManager.ts
 * @description Manages saving and loading test data for embeddings and AI model invocations
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { EmbeddingResult } from '../services/embeddings/types.js';
import type { JobListing, JobDetails } from '../services/spider/types.js';

export interface AIModelInvocation {
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
}

export class TestDataManager {
  private testDataDir: string;
  private embeddingsDir: string;
  private aiInvocationsDir: string;
  private jobsDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.testDataDir = path.join(baseDir, 'test', 'data');
    this.embeddingsDir = path.join(this.testDataDir, 'embeddings');
    this.aiInvocationsDir = path.join(this.testDataDir, 'ai_invocations');
    this.jobsDir = path.join(this.testDataDir, 'jobs');

    // Create directories if they don't exist
    [this.testDataDir, this.embeddingsDir, this.aiInvocationsDir, this.jobsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Generate a short deterministic hash for a string
   */
  private generateHash(text: string): string {
    const hash = crypto.createHash('sha256').update(text).digest('hex');
    return hash.substring(0, 8); // Use first 8 characters of the hash
  }

  /**
   * Save job listings data
   */
  async saveJobListings(listings: JobListing[]): Promise<void> {
    if (process.env.SAVE_TEST_DATA !== 'true') return;

    try {
      // Save listings to a JSON file
      const listingsFile = path.join(this.jobsDir, 'job_listings.json');
      await fs.promises.writeFile(
        listingsFile, 
        JSON.stringify(listings, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Error saving job listings data:', error);
    }
  }

  /**
   * Save job details and related data
   */
  async saveJobDetails(jobListing: JobListing, rawHtml: string, jobDetails: JobDetails): Promise<void> {
    if (process.env.SAVE_TEST_DATA !== 'true') return;

    try {
      const jobDir = path.join(this.jobsDir, jobListing.id);
      await fs.promises.mkdir(jobDir, { recursive: true });

      // Save the raw HTML content
      await fs.promises.writeFile(
        path.join(jobDir, 'raw.html'),
        rawHtml,
        'utf-8'
      );

      // Save the job details
      await fs.promises.writeFile(
        path.join(jobDir, 'details.json'),
        JSON.stringify(jobDetails, null, 2),
        'utf-8'
      );

      // Save the job listing data used to fetch the details
      await fs.promises.writeFile(
        path.join(jobDir, 'listing.json'),
        JSON.stringify(jobListing, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Error saving job details data:', error);
    }
  }

  /**
   * Save embedding result to test data
   */
  async saveEmbedding(text: string, result: EmbeddingResult): Promise<void> {
    if (process.env.SAVE_TEST_DATA !== 'true') return;

    try {
      const hash = this.generateHash(text);
      const filename = `${hash}.json`;
      const filePath = path.join(this.embeddingsDir, filename);

      // Save the embedding data
      await fs.promises.writeFile(
        filePath,
        JSON.stringify({
          text,
          result,
          timestamp: new Date().toISOString()
        }, null, 2),
        'utf-8'
      );

      // Create an index file for easy lookup
      const indexPath = path.join(this.embeddingsDir, 'index.json');
      const index = fs.existsSync(indexPath) 
        ? JSON.parse(await fs.promises.readFile(indexPath, 'utf-8'))
        : {};
      
      index[hash] = {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        filename,
        timestamp: new Date().toISOString()
      };

      await fs.promises.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error saving embedding test data:', error);
    }
  }

  /**
   * Load embedding result from test data
   */
  async loadEmbedding(text: string): Promise<EmbeddingResult | null> {
    try {
      const hash = this.generateHash(text);
      const filePath = path.join(this.embeddingsDir, `${hash}.json`);

      if (!fs.existsSync(filePath)) {
        return null;
      }

      const data = JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
      return data.result;
    } catch (error) {
      console.error('Error loading embedding test data:', error);
      return null;
    }
  }

  /**
   * Save AI model invocation to test data
   */
  async saveAIInvocation(invocation: AIModelInvocation): Promise<void> {
    if (process.env.SAVE_TEST_DATA !== 'true') return;

    try {
      // Create a hash of the request to use as filename
      const requestData = {
        action_type: invocation.action_type,
        model_name: invocation.model_name,
        system_prompt: invocation.system_prompt,
        user_prompt: invocation.user_prompt,
        messages: invocation.messages
      };
      const hash = this.generateHash(JSON.stringify(requestData));
      const filename = `${hash}.json`;
      const filePath = path.join(this.aiInvocationsDir, filename);

      // Save the invocation data
      await fs.promises.writeFile(
        filePath,
        JSON.stringify({
          request: requestData,
          response: {
            text: invocation.response_text,
            metadata: invocation.response_metadata,
            token_usage: invocation.token_usage
          },
          status: invocation.status,
          timestamp: new Date().toISOString()
        }, null, 2),
        'utf-8'
      );

      // Create an index file for easy lookup
      const indexPath = path.join(this.aiInvocationsDir, 'index.json');
      const index = fs.existsSync(indexPath)
        ? JSON.parse(await fs.promises.readFile(indexPath, 'utf-8'))
        : {};

      index[hash] = {
        action_type: invocation.action_type,
        model_name: invocation.model_name,
        prompt_preview: invocation.user_prompt.substring(0, 100) + (invocation.user_prompt.length > 100 ? '...' : ''),
        filename,
        timestamp: new Date().toISOString()
      };

      await fs.promises.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error saving AI invocation test data:', error);
    }
  }

  /**
   * Load AI model invocation from test data
   */
  async loadAIInvocation(request: {
    action_type: string;
    model_name: string;
    system_prompt?: string;
    user_prompt: string;
    messages?: any;
  }): Promise<AIModelInvocation | null> {
    try {
      const hash = this.generateHash(JSON.stringify(request));
      const filePath = path.join(this.aiInvocationsDir, `${hash}.json`);

      if (!fs.existsSync(filePath)) {
        return null;
      }

      const data = JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
      return {
        action_type: request.action_type,
        model_name: request.model_name,
        system_prompt: request.system_prompt,
        user_prompt: request.user_prompt,
        messages: request.messages,
        response_text: data.response.text,
        response_metadata: data.response.metadata,
        token_usage: data.response.token_usage,
        status: data.status,
        model_provider: 'openai', // Default to OpenAI for now
        latency_ms: 0 // Not storing actual latency in test data
      };
    } catch (error) {
      console.error('Error loading AI invocation test data:', error);
      return null;
    }
  }
} 