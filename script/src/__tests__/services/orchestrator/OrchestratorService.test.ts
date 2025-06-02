/**
 * @file OrchestratorService.test.ts
 * @description Tests for the orchestrator service
 */

import { OrchestratorService } from '../../../services/orchestrator/OrchestratorService.js';
import { SpiderService } from '../../../services/spider/SpiderService.js';
import { ProcessorService } from '../../../services/processor/ProcessorService.js';
import { StorageService } from '../../../services/storage/StorageService.js';
import { ConsoleLogger } from '../../../utils/logger.js';
import { OrchestratorConfig } from '../../../services/orchestrator/types.js';
import { JobDetails, JobListing } from '../../../services/spider/types.js';
import { ProcessedJob } from '../../../services/processor/types.js';

// Mock dependencies
jest.mock('../../../services/spider/SpiderService.js');
jest.mock('../../../services/processor/ProcessorService.js');
jest.mock('../../../services/storage/StorageService.js');

describe('OrchestratorService', () => {
  let service: OrchestratorService;
  let spider: jest.Mocked<SpiderService>;
  let processor: jest.Mocked<ProcessorService>;
  let storage: jest.Mocked<StorageService>;
  let logger: ConsoleLogger;
  
  const config: OrchestratorConfig = {
    batchSize: 2,
    maxConcurrency: 2,
    retryAttempts: 3,
    retryDelay: 1000,
    pollInterval: 5000
  };

  const mockJobListing: JobListing = {
    id: '123',
    title: 'Test Job',
    agency: 'Test Agency',
    location: 'Sydney',
    salary: '$100,000',
    closingDate: '2024-03-01',
    url: 'https://test.jobs.nsw.gov.au/job/123',
    jobReference: 'REF123',
    postedDate: '2024-02-01'
  };

  const mockJobDetails: JobDetails = {
    ...mockJobListing,
    description: 'Test description',
    responsibilities: ['Test responsibility'],
    requirements: ['Test requirement'],
    notes: ['Test note'],
    aboutUs: 'About us',
    contactDetails: {
      name: 'Test Contact',
      phone: '1234567890',
      email: 'test@test.com'
    }
  };

  const mockProcessedJob: ProcessedJob = {
    jobDetails: mockJobDetails,
    capabilities: {
      capabilities: [{
        name: 'Test Capability',
        level: 'intermediate',
        description: 'Test description',
        relevance: 0.8
      }],
      occupationalGroups: ['Test Group'],
      focusAreas: ['Test Area']
    },
    taxonomy: {
      jobFamily: 'Test Family',
      jobFunction: 'Test Function',
      keywords: ['test', 'job'],
      skills: {
        technical: ['Test Tech Skill'],
        soft: ['Test Soft Skill']
      }
    },
    embeddings: {
      job: {
        vector: [0.1, 0.2, 0.3],
        metadata: {
          source: 'test',
          type: 'job',
          timestamp: new Date().toISOString()
        }
      },
      capabilities: [{
        vector: [0.4, 0.5, 0.6],
        metadata: {
          source: 'test',
          type: 'capability',
          timestamp: new Date().toISOString()
        }
      }],
      skills: [{
        vector: [0.7, 0.8, 0.9],
        metadata: {
          source: 'test',
          type: 'skill',
          timestamp: new Date().toISOString()
        }
      }]
    },
    metadata: {
      processedAt: new Date().toISOString(),
      version: '1.0.0',
      status: 'completed'
    }
  };

  beforeEach(() => {
    logger = new ConsoleLogger('test');
    spider = new SpiderService(
      { baseUrl: 'test', maxConcurrency: 1, retryAttempts: 1, retryDelay: 1, userAgent: 'test' },
      logger
    ) as jest.Mocked<SpiderService>;
    processor = new ProcessorService(
      { batchSize: 1, maxRetries: 1, retryDelay: 1, version: '1.0.0' },
      {} as any,
      {} as any,
      logger
    ) as jest.Mocked<ProcessorService>;
    storage = new StorageService(
      { supabaseUrl: 'test', supabaseKey: 'test', jobsTable: 'jobs', capabilitiesTable: 'capabilities', embeddingsTable: 'embeddings', taxonomyTable: 'taxonomy', batchSize: 1 },
      logger
    ) as jest.Mocked<StorageService>;

    service = new OrchestratorService(config, spider, processor, storage, logger);
  });

  describe('runPipeline', () => {
    it('should run the complete pipeline successfully', async () => {
      spider.getJobListings.mockResolvedValueOnce([mockJobListing]);
      spider.getJobDetails.mockResolvedValueOnce(mockJobDetails);
      processor.processBatch.mockResolvedValueOnce([mockProcessedJob]);
      storage.storeBatch.mockResolvedValueOnce();

      const result = await service.runPipeline();
      
      expect(result.metrics.jobsScraped).toBe(1);
      expect(result.metrics.jobsProcessed).toBe(1);
      expect(result.metrics.jobsStored).toBe(1);
      expect(result.jobs.scraped).toHaveLength(1);
      expect(result.jobs.processed).toHaveLength(1);
      expect(result.jobs.stored).toHaveLength(1);
      expect(result.jobs.failed.scraping).toHaveLength(0);
      expect(result.jobs.failed.processing).toHaveLength(0);
      expect(result.jobs.failed.storage).toHaveLength(0);
    });

    it('should handle scraping errors', async () => {
      const mockError = new Error('Scraping error');
      spider.getJobListings.mockRejectedValueOnce(mockError);
      jest.spyOn(logger, 'error');

      await expect(service.runPipeline()).rejects.toThrow('Scraping error');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle processing errors', async () => {
      spider.getJobListings.mockResolvedValueOnce([mockJobListing]);
      spider.getJobDetails.mockResolvedValueOnce(mockJobDetails);
      processor.processBatch.mockResolvedValueOnce([undefined]);

      const result = await service.runPipeline();
      
      expect(result.metrics.jobsProcessed).toBe(0);
      expect(result.metrics.failedProcesses).toBe(1);
      expect(result.jobs.failed.processing).toHaveLength(1);
    });

    it('should handle storage errors', async () => {
      spider.getJobListings.mockResolvedValueOnce([mockJobListing]);
      spider.getJobDetails.mockResolvedValueOnce(mockJobDetails);
      processor.processBatch.mockResolvedValueOnce([mockProcessedJob]);
      storage.storeBatch.mockRejectedValueOnce(new Error('Storage error'));

      const result = await service.runPipeline();
      
      expect(result.metrics.jobsStored).toBe(0);
      expect(result.metrics.failedStorage).toBe(1);
      expect(result.jobs.failed.storage).toHaveLength(1);
    });

    it('should filter jobs based on options', async () => {
      spider.getJobListings.mockResolvedValueOnce([
        mockJobListing,
        { ...mockJobListing, id: '456', agency: 'Other Agency' }
      ]);
      spider.getJobDetails.mockResolvedValueOnce(mockJobDetails);
      processor.processBatch.mockResolvedValueOnce([mockProcessedJob]);
      storage.storeBatch.mockResolvedValueOnce();

      const result = await service.runPipeline({
        agencies: ['Test Agency']
      });
      
      expect(result.jobs.scraped).toHaveLength(1);
      expect(result.jobs.scraped[0].agency).toBe('Test Agency');
    });
  });

  describe('pipeline control', () => {
    it('should stop the pipeline', async () => {
      spider.getJobListings.mockResolvedValueOnce([mockJobListing]);
      
      const pipelinePromise = service.runPipeline();
      await service.stopPipeline();
      const result = await pipelinePromise;
      
      expect(result.metrics.jobsScraped).toBeLessThanOrEqual(1);
      expect(service.getStatus()).not.toBe('running');
    });

    it('should pause and resume the pipeline', async () => {
      spider.getJobListings.mockResolvedValueOnce([mockJobListing, mockJobListing]);
      spider.getJobDetails.mockResolvedValue(mockJobDetails);
      
      const pipelinePromise = service.runPipeline();
      await service.pausePipeline();
      expect(service.getStatus()).toBe('paused');
      
      await service.resumePipeline();
      expect(service.getStatus()).toBe('running');
      
      const result = await pipelinePromise;
      expect(result.metrics.jobsScraped).toBe(2);
    });
  });

  describe('metrics', () => {
    it('should track pipeline metrics', async () => {
      spider.getJobListings.mockResolvedValueOnce([mockJobListing]);
      spider.getJobDetails.mockResolvedValueOnce(mockJobDetails);
      processor.processBatch.mockResolvedValueOnce([mockProcessedJob]);
      storage.storeBatch.mockResolvedValueOnce();

      await service.runPipeline();
      const metrics = service.getMetrics();
      
      expect(metrics.jobsScraped).toBe(1);
      expect(metrics.jobsProcessed).toBe(1);
      expect(metrics.jobsStored).toBe(1);
      expect(metrics.startTime).toBeDefined();
      expect(metrics.endTime).toBeDefined();
      expect(metrics.totalDuration).toBeGreaterThan(0);
    });
  });
}); 