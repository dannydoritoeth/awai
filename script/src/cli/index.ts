/**
 * @file index.ts
 * @description NSW Government Jobs ETL Pipeline
 */

try {
  const dotenv = await import('dotenv');
  const { ConsoleLogger } = await import('../utils/logger.js');
  const { StorageService } = await import('../services/storage/StorageService.js');
  const { SpiderService } = await import('../services/spider/SpiderService.js');
  const { ProcessorService } = await import('../services/processor/ProcessorService.js');
  const { AIAnalyzer } = await import('../services/analyzer/AIAnalyzer.js');
  const { EmbeddingService } = await import('../services/embeddings/EmbeddingService.js');
  const { OrchestratorService } = await import('../services/orchestrator/OrchestratorService.js');

  // Load environment variables
  dotenv.config({ path: '.env.local' });

  // Basic error handler
  const handleError = (error: any) => {
    console.error('\nError Details:');
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    } else if (error && typeof error === 'object') {
      try {
        console.error('Object:', JSON.stringify(error, null, 2));
      } catch (e) {
        console.error('Non-serializable object:', error);
        console.error('Object keys:', Object.keys(error));
        for (const key of Object.keys(error)) {
          try {
            console.error(`${key}:`, error[key]);
          } catch (e) {
            console.error(`${key}: [Cannot stringify value]`);
          }
        }
      }
    } else {
      console.error('Unknown error:', error);
    }
    process.exit(1);
  };

  process.on('uncaughtException', handleError);
  process.on('unhandledRejection', (reason) => {
    console.error('\nUnhandled Promise Rejection:');
    handleError(reason);
  });

  // Initialize logger
  const logger = new ConsoleLogger('cli');

  async function main() {
    try {
      logger.info('Starting ETL pipeline...');

      // Initialize services
      logger.info('Initializing services...');

      // Initialize Spider Service
      logger.info('Initializing SpiderService...');
      const spider = new SpiderService({
        baseUrl: process.env.NSW_JOBS_URL!,
        maxConcurrency: Number(process.env.MAX_CONCURRENCY) || 5,
        retryAttempts: Number(process.env.RETRY_ATTEMPTS) || 3,
        retryDelay: Number(process.env.RETRY_DELAY) || 1000,
        userAgent: process.env.USER_AGENT || 'NSW Jobs ETL Bot'
      }, logger);

      // Initialize AI Services
      logger.info('Initializing AI services...');
      const analyzer = new AIAnalyzer({
        openaiApiKey: process.env.OPENAI_API_KEY!,
        openaiModel: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        maxRetries: Number(process.env.RETRY_ATTEMPTS) || 3,
        retryDelay: Number(process.env.RETRY_DELAY) || 1000,
        temperature: 0.7,
        maxTokens: 2000
      }, logger);

      const embeddingService = new EmbeddingService({
        openaiApiKey: process.env.OPENAI_API_KEY!,
        model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        maxTokens: 8000,
        batchSize: Number(process.env.BATCH_SIZE) || 10,
        maxRetries: Number(process.env.RETRY_ATTEMPTS) || 3,
        retryDelay: Number(process.env.RETRY_DELAY) || 1000
      }, logger);

      // Initialize Processor Service
      logger.info('Initializing ProcessorService...');
      const processor = new ProcessorService({
        batchSize: Number(process.env.BATCH_SIZE) || 10,
        maxRetries: Number(process.env.RETRY_ATTEMPTS) || 3,
        retryDelay: Number(process.env.RETRY_DELAY) || 1000,
        version: '1.0.0'
      }, analyzer, embeddingService, logger);

      // Initialize Storage Services
      logger.info('Initializing Storage Services...');
      
      // Staging DB
      logger.info('Initializing Staging DB connection...');
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
        institutionId: process.env.INSTITUTION_ID || ''
      }, logger);

      // Initialize staging DB
      logger.info('Testing staging DB connection...');
      await stagingStorage.initialize();
      logger.info('Staging DB connection successful');

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
      const result = await orchestrator.runPipeline({
        maxRecords: Number(process.env.MAX_RECORDS) || 0,
        continueOnError: true
      });

      // Log results
      logger.info('Pipeline execution completed. Results:', {
        jobsScraped: result.metrics.jobsScraped,
        jobsProcessed: result.metrics.jobsProcessed,
        jobsStored: result.metrics.jobsStored,
        failedScrapes: result.metrics.failedScrapes,
        failedProcesses: result.metrics.failedProcesses,
        failedStorage: result.metrics.failedStorage,
        startTime: result.metrics.startTime,
        endTime: new Date(),
        totalDuration: `${(new Date().getTime() - result.metrics.startTime.getTime()) / 1000}s`,
        errors: result.metrics.errors.length
      });

      if (result.metrics.errors.length > 0) {
        logger.warn('Pipeline completed with errors:', result.metrics.errors);
      }

      logger.info('Pipeline completed successfully');
    } catch (error) {
      logger.error('Error in pipeline execution:', error);
      throw error;
    }
  }

  // Run the pipeline
  main().catch(handleError);

} catch (error) {
  console.error('Error during module loading:', error);
  process.exit(1);
} 