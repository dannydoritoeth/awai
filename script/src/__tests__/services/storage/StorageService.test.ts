/**
 * @file StorageService.test.ts
 * @description Tests for the storage service
 */

import { StorageService } from '../../../services/storage/StorageService.js';
import { StorageConfig } from '../../../services/storage/types.js';
import { ConsoleLogger } from '../../../utils/logger.js';
import { ProcessedJob } from '../../../services/processor/types.js';
import { JobDetails } from '../../../services/spider/types.js';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    upsert: jest.fn(),
    rpc: jest.fn(),
    range: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis()
  })
}));

describe('StorageService', () => {
  let service: StorageService;
  let logger: ConsoleLogger;
  let mockSupabase: any;
  
  const config: StorageConfig = {
    supabaseUrl: 'https://test.supabase.co',
    supabaseKey: 'test-key',
    jobsTable: 'jobs',
    capabilitiesTable: 'capabilities',
    embeddingsTable: 'embeddings',
    taxonomyTable: 'taxonomy',
    batchSize: 2
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
    mockSupabase = require('@supabase/supabase-js').createClient();
    service = new StorageService(config, logger);
  });

  describe('storeJob', () => {
    it('should store a job and related data successfully', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: { id: 'tx1' } });
      mockSupabase.upsert.mockResolvedValue({ error: null });

      await service.storeJob(mockProcessedJob);

      expect(mockSupabase.from).toHaveBeenCalledWith(config.jobsTable);
      expect(mockSupabase.from).toHaveBeenCalledWith(config.capabilitiesTable);
      expect(mockSupabase.from).toHaveBeenCalledWith(config.embeddingsTable);
      expect(mockSupabase.from).toHaveBeenCalledWith(config.taxonomyTable);
      expect(mockSupabase.upsert).toHaveBeenCalled();
    });

    it('should handle storage errors and rollback transaction', async () => {
      const mockError = new Error('Storage error');
      mockSupabase.rpc.mockResolvedValueOnce({ data: { id: 'tx1' } });
      mockSupabase.upsert.mockRejectedValueOnce(mockError);
      jest.spyOn(logger, 'error');

      await expect(service.storeJob(mockProcessedJob)).rejects.toThrow('Storage error');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('rollback_transaction', { transaction_id: 'tx1' });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getJobById', () => {
    it('should retrieve a job by ID', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockJobDetails, error: null });

      const result = await service.getJobById('123');
      
      expect(result).toEqual(mockJobDetails);
      expect(mockSupabase.from).toHaveBeenCalledWith(config.jobsTable);
      expect(mockSupabase.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '123');
    });

    it('should handle errors when retrieving job', async () => {
      const mockError = new Error('Query error');
      mockSupabase.single.mockResolvedValueOnce({ error: mockError });
      jest.spyOn(logger, 'error');

      const result = await service.getJobById('123');
      
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getJobsByFilter', () => {
    it('should retrieve jobs by filter criteria', async () => {
      mockSupabase.order.mockResolvedValueOnce({ data: [mockJobDetails], error: null });

      const result = await service.getJobsByFilter(
        { agency: 'Test Agency' },
        { limit: 10, offset: 0, orderBy: 'postedDate', orderDirection: 'desc' }
      );
      
      expect(result).toEqual([mockJobDetails]);
      expect(mockSupabase.from).toHaveBeenCalledWith(config.jobsTable);
      expect(mockSupabase.eq).toHaveBeenCalledWith('agency', 'Test Agency');
      expect(mockSupabase.limit).toHaveBeenCalledWith(10);
      expect(mockSupabase.range).toHaveBeenCalledWith(0, 9);
      expect(mockSupabase.order).toHaveBeenCalledWith('postedDate', { ascending: false });
    });
  });

  describe('getMetrics', () => {
    it('should return current storage metrics', async () => {
      await service.storeJob(mockProcessedJob);
      const metrics = service.getMetrics();
      
      expect(metrics).toMatchObject({
        totalStored: 1,
        successfulStores: 1,
        failedStores: 0,
        startTime: expect.any(Date),
        endTime: expect.any(Date),
        errors: []
      });
    });
  });
}); 