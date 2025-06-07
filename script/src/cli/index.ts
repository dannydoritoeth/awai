/**
 * @file index.ts
 * @description NSW Government Jobs ETL Pipeline
 */

import { AIAnalyzer } from '../services/analyzer/AIAnalyzer.js';
import { ProcessorService } from '../services/processor/ProcessorService.js';
import { EmbeddingService } from '../services/embeddings/EmbeddingService.js';
import { StorageService } from '../services/storage/StorageService.js';
import { SpiderService } from '../services/spider/SpiderService.js';
import { OrchestratorService } from '../services/orchestrator/OrchestratorService.js';
import { ConsoleLogger } from '../utils/logger.js';
import { Pool } from 'pg';

async function main() {
  try {
    // Initialize Logger
    const logger = ConsoleLogger.getInstance('cli');
    
    // Log startup banner with configuration details
    logger.logStartupBanner({
      projectRoot: process.cwd(),
      envFile: process.env.ENV_FILE || '.env.local',
      envVars: {
        NODE_ENV: process.env.NODE_ENV,
        MAX_RECORDS: process.env.MAX_RECORDS,
        SCRAPE_ONLY: process.env.SCRAPE_ONLY,
        BATCH_SIZE: process.env.BATCH_SIZE,
        RETRY_ATTEMPTS: process.env.RETRY_ATTEMPTS,
        RETRY_DELAY: process.env.RETRY_DELAY
      }
    });

    // Parse the pool if it was passed
    let pgStagingPool: Pool | undefined;
    if (process.env.PG_STAGING_POOL) {
      try {
        pgStagingPool = JSON.parse(process.env.PG_STAGING_POOL);
      } catch (error) {
        logger.warn('Failed to parse PG_STAGING_POOL:', error);
      }
    }

    // Initialize Storage Services
    logger.info('Initializing StorageService...');
    const stagingStorage = new StorageService({
      stagingSupabaseUrl: process.env.SUPABASE_STAGING_URL!,
      stagingSupabaseKey: process.env.SUPABASE_STAGING_KEY!,
      liveSupabaseUrl: process.env.SUPABASE_LIVE_URL!,
      liveSupabaseKey: process.env.SUPABASE_LIVE_KEY!,
      jobsTable: process.env.JOBS_TABLE || 'jobs',
      companiesTable: process.env.COMPANIES_TABLE || 'companies',
      rolesTable: process.env.ROLES_TABLE || 'roles',
      skillsTable: process.env.SKILLS_TABLE || 'skills',
      capabilitiesTable: process.env.CAPABILITIES_TABLE || 'capabilities',
      embeddingsTable: process.env.EMBEDDINGS_TABLE || 'embeddings',
      taxonomyTable: process.env.TAXONOMY_TABLE || 'taxonomy',
      batchSize: Number(process.env.BATCH_SIZE) || 10,
      maxRetries: Number(process.env.RETRY_ATTEMPTS) || 3,
      retryDelay: Number(process.env.RETRY_DELAY) || 1000,
      institutionId: process.env.INSTITUTION_ID || '',
      pgStagingPool
    }, logger);

    // Initialize staging DB
    logger.info('Testing staging DB connection...');
    await stagingStorage.initialize();
    logger.info('Staging DB connection successful');

    // Initialize Spider Service
    logger.info('Initializing SpiderService...');
    const spider = new SpiderService({
      baseUrl: process.env.NSW_JOBS_URL!,
      userAgent: process.env.USER_AGENT || 'Mozilla/5.0',
      maxConcurrency: Number(process.env.MAX_CONCURRENCY) || 5,
      retryAttempts: Number(process.env.RETRY_ATTEMPTS) || 3,
      retryDelay: Number(process.env.RETRY_DELAY) || 1000
    }, logger);

    // Initialize Embedding Service
    logger.info('Initializing EmbeddingService...');
    const embeddingService = new EmbeddingService({
      openaiApiKey: process.env.OPENAI_API_KEY!,
      model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      maxTokens: 8000,
      batchSize: Number(process.env.BATCH_SIZE) || 10,
      maxRetries: Number(process.env.RETRY_ATTEMPTS) || 3,
      retryDelay: Number(process.env.RETRY_DELAY) || 1000
    }, logger);

    // Initialize AI Analyzer
    logger.info('Initializing AIAnalyzer...');
    const aiAnalyzer = new AIAnalyzer({
      openaiApiKey: process.env.OPENAI_API_KEY!,
      openaiModel: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      maxRetries: Number(process.env.RETRY_ATTEMPTS) || 3,
      retryDelay: Number(process.env.RETRY_DELAY) || 1000,
      timeout: Number(process.env.AI_TIMEOUT) || 30000,
      temperature: Number(process.env.AI_TEMPERATURE) || 0,
      maxTokens: Number(process.env.AI_MAX_TOKENS) || 2000,
      storageService: stagingStorage
    }, logger);

    // Load framework capabilities and taxonomies
    logger.info('Loading framework capabilities and taxonomies...');
    const frameworkCapabilities = await stagingStorage.getFrameworkCapabilities();
    const taxonomyGroups = await stagingStorage.getTaxonomyGroups();

    await aiAnalyzer.setFrameworkCapabilities(frameworkCapabilities);
    await aiAnalyzer.setTaxonomyGroups(taxonomyGroups);

    logger.info('AIAnalyzer initialized with:', {
      frameworkCapabilitiesCount: frameworkCapabilities.length,
      taxonomyGroupsCount: taxonomyGroups.length
    });

    // Initialize Processor
    logger.info('Initializing ProcessorService...');
    const processor = new ProcessorService({
      batchSize: Number(process.env.BATCH_SIZE) || 10,
      maxRetries: Number(process.env.RETRY_ATTEMPTS) || 3,
      retryDelay: Number(process.env.RETRY_DELAY) || 1000,
      version: '1.0.0'
    }, logger, aiAnalyzer, embeddingService, stagingStorage);
    await processor.initialize();
    logger.info('ProcessorService initialized');

    // Initialize Orchestrator
    logger.info('Initializing OrchestratorService...');
    const orchestrator = new OrchestratorService({
      batchSize: Number(process.env.BATCH_SIZE) || 10,
      maxConcurrency: Number(process.env.MAX_CONCURRENCY) || 5,
      retryAttempts: Number(process.env.RETRY_ATTEMPTS) || 3,
      retryDelay: Number(process.env.RETRY_DELAY) || 1000,
      pollInterval: 1000
    }, spider, processor, stagingStorage, logger);

    // Run the pipeline
    logger.info('Starting pipeline execution...');
    logger.info('Environment options:', {
      MAX_RECORDS: process.env.MAX_RECORDS,
      SCRAPE_ONLY: process.env.SCRAPE_ONLY,
      BATCH_SIZE: process.env.BATCH_SIZE,
      RETRY_ATTEMPTS: process.env.RETRY_ATTEMPTS,
      RETRY_DELAY: process.env.RETRY_DELAY
    });

    const pipelineOptions = {
      maxRecords: Number(process.env.MAX_RECORDS) || 0,
      continueOnError: true,
      scrapeOnly: process.env.SCRAPE_ONLY === 'true'
    };

    logger.info('Pipeline options:', pipelineOptions);
    const result = await orchestrator.runPipeline(pipelineOptions);

    logger.info('Pipeline execution complete');
  } catch (error) {
    console.error('Pipeline execution failed:', error);
    process.exit(1);
  }
}

main(); 