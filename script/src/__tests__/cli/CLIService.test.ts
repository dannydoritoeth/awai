/**
 * @file CLIService.test.ts
 * @description Tests for the CLI service
 */

import { CommandLineService } from '../../cli/CLIService.js';
import { CLICommand } from '../../cli/types.js';

// Mock dependencies
jest.mock('commander');
jest.mock('inquirer');
jest.mock('ora');
jest.mock('chalk');

describe('CommandLineService', () => {
  let service: CommandLineService;

  beforeEach(() => {
    service = new CommandLineService('1.0.0');
  });

  describe('parseArguments', () => {
    it('should parse command line arguments correctly', () => {
      const args = [
        'node',
        'index.js',
        'run',
        '--config',
        'custom.env',
        '--start-date',
        '2024-02-01'
      ];

      const options = service.parseArguments(args);

      expect(options.command).toBe('run');
      expect(options.configPath).toBe('custom.env');
      expect(options.pipelineOptions?.startDate).toEqual(new Date('2024-02-01'));
    });

    it('should use default values when no arguments provided', () => {
      const args = ['node', 'index.js'];

      const options = service.parseArguments(args);

      expect(options.command).toBe('help');
      expect(options.configPath).toBe('.env');
      expect(options.logPath).toBe('logs');
      expect(options.outputPath).toBe('output');
      expect(options.interactive).toBe(true);
    });

    it('should parse pipeline options correctly', () => {
      const args = [
        'node',
        'index.js',
        'run',
        '--agencies',
        'NSW Health',
        'Transport',
        '--locations',
        'Sydney',
        '--skip-processing',
        '--continue-on-error'
      ];

      const options = service.parseArguments(args);

      expect(options.pipelineOptions).toEqual({
        agencies: ['NSW Health', 'Transport'],
        locations: ['Sydney'],
        skipProcessing: true,
        continueOnError: true
      });
    });
  });

  describe('progress and metrics', () => {
    it('should show progress correctly', () => {
      service.showProgress(5, 10, 'processing');
      // Verify ora spinner was updated correctly
      expect(service['spinner'].text).toContain('processing: 5/10 (50%)');
    });

    it('should show metrics correctly', () => {
      const metrics = {
        jobsScraped: 10,
        jobsProcessed: 8,
        jobsStored: 8,
        errors: [{
          stage: 'processing',
          error: 'Test error',
          timestamp: new Date().toISOString()
        }]
      };

      service.showMetrics(metrics);
      // Verify console output was formatted correctly
    });
  });

  describe('user interaction', () => {
    it('should prompt for user input', async () => {
      const mockAnswer = 'test answer';
      require('inquirer').prompt.mockResolvedValueOnce({ answer: mockAnswer });

      const result = await service.prompt('Test question');
      expect(result).toBe(mockAnswer);
    });

    it('should handle confirmation', async () => {
      require('inquirer').prompt.mockResolvedValueOnce({ confirmed: true });

      const result = await service.confirm('Proceed?');
      expect(result).toBe(true);
    });

    it('should handle selection', async () => {
      const choices = ['option1', 'option2'];
      require('inquirer').prompt.mockResolvedValueOnce({ selected: choices[0] });

      const result = await service.select('Choose:', choices);
      expect(result).toBe(choices[0]);
    });
  });

  describe('command validation', () => {
    const validCommands: CLICommand[] = ['run', 'status', 'stop', 'pause', 'resume', 'help'];

    validCommands.forEach(cmd => {
      it(`should accept valid command: ${cmd}`, () => {
        const args = ['node', 'index.js', cmd];
        const options = service.parseArguments(args);
        expect(options.command).toBe(cmd);
      });
    });

    it('should default to help for invalid commands', () => {
      const args = ['node', 'index.js', 'invalid-command'];
      const options = service.parseArguments(args);
      expect(options.command).toBe('help');
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully', () => {
      const error = new Error('Test error');
      service.showError(error);
      // Verify error was displayed correctly
    });

    it('should handle success messages', () => {
      service.showSuccess('Operation completed');
      // Verify success message was displayed correctly
    });
  });
}); 