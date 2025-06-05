/**
 * @file ProcessorService.test.ts
 * @description Tests for the processor service
 */

import { ProcessorService } from '../../../services/processor/ProcessorService.js';
import { AIAnalyzer } from '../../../services/analyzer/AIAnalyzer.js';
import { EmbeddingService } from '../../../services/embeddings/EmbeddingService.js';
import { ConsoleLogger } from '../../../utils/logger.js';
import { ProcessorConfig } from '../../../services/processor/types.js';
import { JobDetails } from '../../../services/spider/types.js';
import { CapabilityAnalysisResult, TaxonomyAnalysisResult } from '../../../services/analyzer/templates/capabilityAnalysis.js';

// Mock dependencies
jest.mock('../../../services/analyzer/AIAnalyzer.js');
jest.mock('../../../services/embeddings/EmbeddingService.js');

describe('ProcessorService', () => {
  let service: ProcessorService;
  let analyzer: jest.Mocked<AIAnalyzer>;
  let embeddingService: jest.Mocked<EmbeddingService>;
  let logger: ConsoleLogger;
  
  const config: ProcessorConfig = {
    batchSize: 2,
    maxRetries: 3,
    retryDelay: 1000,
    version: '1.0.0'
  };

  const mockJobDetails: JobDetails = {
    id: '123',
    title: 'Test Job',
    agency: 'Test Agency',
    location: 'Sydney',
    salary: '$100,000',
    closingDate: '2024-03-01',
    url: 'https://test.jobs.nsw.gov.au/job/123',
    jobReference: 'REF123',
    postedDate: '2024-02-01',
    description: 'Test job description',
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

  const mockCapabilities: CapabilityAnalysisResult = {
    capabilities: [
      {
        name: 'Test Capability',
        level: 'intermediate' as const,
        description: 'Test description',
        relevance: 0.8
      }
    ],
    occupationalGroups: ['Test Group'],
    focusAreas: ['Test Area']
  };

  const mockTaxonomy: TaxonomyAnalysisResult = {
    jobFamily: 'Test Family',
    jobFunction: 'Test Function',
    keywords: ['test', 'job'],
    skills: {
      technical: ['Test Tech Skill'],
      soft: ['Test Soft Skill']
    }
  };

  const mockEmbedding = {
    vector: [0.1, 0.2, 0.3],
    metadata: {
      source: 'test',
      type: 'test',
      timestamp: new Date().toISOString()
    }
  };

  beforeEach(() => {
    logger = new ConsoleLogger('test');
    analyzer = new AIAnalyzer({ openaiApiKey: 'test' }, logger) as jest.Mocked<AIAnalyzer>;
    embeddingService = new EmbeddingService(
      { model: 'test', dimensions: 3, type: 'job' },
      logger,
      'test'
    ) as jest.Mocked<EmbeddingService>;

    // Setup mock implementations
    analyzer.analyzeJobDescription.mockResolvedValue(mockCapabilities);
    analyzer.createJobSummary.mockResolvedValue(mockTaxonomy);
    embeddingService.generateJobEmbedding.mockResolvedValue(mockEmbedding);
    embeddingService.generateCapabilityEmbedding.mockResolvedValue(mockEmbedding);
    embeddingService.generateSkillEmbedding.mockResolvedValue(mockEmbedding);

    service = new ProcessorService(config, analyzer, embeddingService, logger);
  });

  describe('processJob', () => {
    it('should process a job successfully', async () => {
      const result = await service.processJob(mockJobDetails);
      
      expect(result).toMatchObject({
        jobDetails: mockJobDetails,
        capabilities: mockCapabilities,
        taxonomy: mockTaxonomy,
        embeddings: {
          job: mockEmbedding,
          capabilities: [mockEmbedding],
          skills: [mockEmbedding, mockEmbedding]
        },
        metadata: {
          version: config.version,
          status: 'completed'
        }
      });

      expect(analyzer.analyzeJobDescription).toHaveBeenCalledWith(mockJobDetails.description);
      expect(analyzer.createJobSummary).toHaveBeenCalledWith(mockJobDetails.description);
      expect(embeddingService.generateJobEmbedding).toHaveBeenCalledWith(mockJobDetails.description);
    });

    it('should handle processing errors', async () => {
      const mockError = new Error('Processing error');
      analyzer.analyzeJobDescription.mockRejectedValueOnce(mockError);
      jest.spyOn(logger, 'error');

      await expect(service.processJob(mockJobDetails)).rejects.toThrow('Processing error');
      expect(logger.error).toHaveBeenCalledWith(
        `Error processing job ${mockJobDetails.title}:`,
        mockError
      );
    });
  });

  describe('processBatch', () => {
    it('should process multiple jobs in batches', async () => {
      const jobs = [mockJobDetails, { ...mockJobDetails, id: '456' }];
      const results = await service.processBatch(jobs);
      
      expect(results).toHaveLength(2);
      expect(results[0].jobDetails.id).toBe('123');
      expect(results[1].jobDetails.id).toBe('456');
    });

    it('should continue processing on individual job failures', async () => {
      const jobs = [mockJobDetails, { ...mockJobDetails, id: '456' }];
      analyzer.analyzeJobDescription
        .mockResolvedValueOnce(mockCapabilities)
        .mockRejectedValueOnce(new Error('Test error'));

      jest.spyOn(logger, 'error');
      
      const results = await service.processBatch(jobs);
      expect(results).toHaveLength(1);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getMetrics', () => {
    it('should return current processing metrics', async () => {
      await service.processJob(mockJobDetails);
      const metrics = service.getMetrics();
      
      expect(metrics).toMatchObject({
        totalProcessed: 1,
        successfulProcesses: 1,
        failedProcesses: 0,
        averageProcessingTime: expect.any(Number),
        errors: []
      });
    });
  });
}); 