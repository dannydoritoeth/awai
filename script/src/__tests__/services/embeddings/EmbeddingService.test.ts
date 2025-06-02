/**
 * @file EmbeddingService.test.ts
 * @description Tests for the embedding service
 */

import { EmbeddingService } from '../../../services/embeddings/EmbeddingService.js';
import { EmbeddingConfig } from '../../../services/embeddings/templates/embeddingTemplates.js';
import { ConsoleLogger } from '../../../utils/logger.js';

// Mock OpenAI
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'Formatted content for embedding'
            }
          }]
        })
      }
    },
    embeddings: {
      create: jest.fn().mockResolvedValue({
        data: [{
          embedding: [0.1, 0.2, 0.3]
        }]
      })
    }
  }))
}));

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let logger: ConsoleLogger;
  
  const config: EmbeddingConfig = {
    model: 'text-embedding-3-small',
    dimensions: 1536,
    type: 'job'
  };

  beforeEach(() => {
    logger = new ConsoleLogger('test');
    service = new EmbeddingService(config, logger, 'test-api-key');
  });

  describe('generateJobEmbedding', () => {
    it('should generate job embeddings with correct metadata', async () => {
      const result = await service.generateJobEmbedding('Test job description');
      
      expect(result.vector).toEqual([0.1, 0.2, 0.3]);
      expect(result.metadata).toEqual({
        source: 'job_description',
        type: 'job',
        timestamp: expect.any(String)
      });
    });

    it('should handle errors gracefully', async () => {
      const mockError = new Error('API Error');
      jest.spyOn(logger, 'error');
      
      const mockOpenAI = require('openai').OpenAI;
      mockOpenAI.mockImplementationOnce(() => ({
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(mockError)
          }
        }
      }));

      await expect(service.generateJobEmbedding('Test')).rejects.toThrow('API Error');
      expect(logger.error).toHaveBeenCalledWith('Error generating job embedding:', mockError);
    });
  });

  describe('generateCapabilityEmbedding', () => {
    it('should generate capability embeddings with correct metadata', async () => {
      const result = await service.generateCapabilityEmbedding('Test capability');
      
      expect(result.vector).toEqual([0.1, 0.2, 0.3]);
      expect(result.metadata).toEqual({
        source: 'capability_framework',
        type: 'capability',
        timestamp: expect.any(String)
      });
    });
  });

  describe('generateSkillEmbedding', () => {
    it('should generate skill embeddings with correct metadata', async () => {
      const result = await service.generateSkillEmbedding('Test skill');
      
      expect(result.vector).toEqual([0.1, 0.2, 0.3]);
      expect(result.metadata).toEqual({
        source: 'skill_taxonomy',
        type: 'skill',
        timestamp: expect.any(String)
      });
    });
  });
}); 