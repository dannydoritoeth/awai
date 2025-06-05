/**
 * @file AIAnalyzer.test.ts
 * @description Tests for the AI analysis service
 */

import { AIAnalyzer, AIAnalyzerConfig } from '../../../services/analyzer/AIAnalyzer.js';
import { ConsoleLogger } from '../../../utils/logger.js';

// Mock OpenAI
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                responsibilities: ['Test responsibility'],
                experienceLevel: 'mid',
                technicalRequirements: ['Test requirement'],
                softSkills: ['Test skill'],
                teamStructure: {
                  reportsTo: 'Manager',
                  manages: ['Team Member']
                }
              })
            }
          }]
        })
      }
    }
  }))
}));

describe('AIAnalyzer', () => {
  let analyzer: AIAnalyzer;
  let logger: ConsoleLogger;
  
  const config: AIAnalyzerConfig = {
    openaiApiKey: 'test-key',
    maxRetries: 1,
    timeout: 1000
  };

  beforeEach(() => {
    logger = new ConsoleLogger('test');
    analyzer = new AIAnalyzer(config, logger);
  });

  describe('analyzeJobDescription', () => {
    it('should analyze job description and return structured data', async () => {
      const result = await analyzer.analyzeJobDescription('Test job description');
      
      expect(result).toEqual({
        responsibilities: ['Test responsibility'],
        experienceLevel: 'mid',
        technicalRequirements: ['Test requirement'],
        softSkills: ['Test skill'],
        teamStructure: {
          reportsTo: 'Manager',
          manages: ['Team Member']
        }
      });
    });

    it('should handle errors gracefully', async () => {
      // Mock OpenAI error
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

      await expect(analyzer.analyzeJobDescription('Test')).rejects.toThrow('API Error');
      expect(logger.error).toHaveBeenCalledWith('Error analyzing job description:', mockError);
    });
  });

  describe('createJobSummary', () => {
    beforeEach(() => {
      // Mock OpenAI response for summary
      const mockOpenAI = require('openai').OpenAI;
      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: `
Summary line
Key role objectives:
- Objective 1
- Objective 2
Essential requirements:
- Requirement 1
Unique aspects:
- Unique 1
Department context:
- Context info`
                }
              }]
            })
          }
        }
      }));
    });

    it('should create a job summary with structured sections', async () => {
      const result = await analyzer.createJobSummary('Test job description');
      
      expect(result).toEqual({
        summary: 'Summary line',
        keyObjectives: ['Objective 1', 'Objective 2'],
        essentialRequirements: ['Requirement 1'],
        uniqueAspects: ['Unique 1'],
        departmentContext: 'Context info'
      });
    });
  });
}); 