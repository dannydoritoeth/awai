/**
 * @file index.test.ts
 * @description Tests for the main CLI entry point
 */

import { OrchestratorService } from '../../services/orchestrator/OrchestratorService.js';
import { SpiderService } from '../../services/spider/SpiderService.js';
import { ProcessorService } from '../../services/processor/ProcessorService.js';
import { StorageService } from '../../services/storage/StorageService.js';
import { ConsoleLogger } from '../../utils/logger.js';
import { CommandLineService } from '../../cli/CLIService.js';
import { PipelineMetrics } from '../../services/orchestrator/types.js';

// Mock services
jest.mock('../../services/orchestrator/OrchestratorService.js');
jest.mock('../../services/spider/SpiderService.js');
jest.mock('../../services/processor/ProcessorService.js');
jest.mock('../../services/storage/StorageService.js');
jest.mock('../../utils/logger.js');
jest.mock('../../cli/CLIService.js');

describe('CLI Entry Point', () => {
  let orchestrator: jest.Mocked<OrchestratorService>;
  let cli: jest.Mocked<CommandLineService>;
  let logger: jest.Mocked<ConsoleLogger>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup mocks
    orchestrator = new OrchestratorService({} as any, {} as any, {} as any, {} as any, {} as any) as jest.Mocked<OrchestratorService>;
    cli = new CommandLineService('1.0.0') as jest.Mocked<CommandLineService>;
    logger = new ConsoleLogger('test') as jest.Mocked<ConsoleLogger>;

    // Mock process.exit to prevent tests from actually exiting
    const mockExit = jest.spyOn(process, 'exit')
      .mockImplementation((code?: number | string | null) => undefined as never);
  });

  describe('Command Execution', () => {
    it('should execute run command successfully', async () => {
      // Mock CLI options
      cli.parseArguments.mockReturnValue({
        command: 'run',
        configPath: '.env',
        logPath: 'logs',
        outputPath: 'output',
        interactive: false
      });

      // Mock orchestrator response
      const mockMetrics: PipelineMetrics = {
        jobsScraped: 10,
        jobsProcessed: 8,
        jobsStored: 8,
        failedScrapes: 0,
        failedProcesses: 0,
        failedStorage: 0,
        startTime: new Date(),
        endTime: new Date(),
        totalDuration: 1000,
        errors: []
      };

      orchestrator.runPipeline.mockResolvedValue({
        metrics: mockMetrics,
        jobs: {
          scraped: [],
          processed: [],
          stored: [],
          failed: {
            scraping: [],
            processing: [],
            storage: []
          }
        }
      });

      // Import and execute the CLI
      await import('../../cli/index.js');

      expect(orchestrator.runPipeline).toHaveBeenCalled();
      expect(cli.showMetrics).toHaveBeenCalled();
      expect(cli.showSuccess).toHaveBeenCalledWith('Pipeline completed successfully');
    });

    it('should handle run command with interactive mode', async () => {
      // Mock CLI options
      cli.parseArguments.mockReturnValue({
        command: 'run',
        configPath: '.env',
        logPath: 'logs',
        outputPath: 'output',
        interactive: true
      });

      // Mock user confirmation
      cli.confirm.mockResolvedValue(false);

      // Import and execute the CLI
      await import('../../cli/index.js');

      expect(cli.confirm).toHaveBeenCalledWith('Start the ETL pipeline?');
      expect(cli.showSuccess).toHaveBeenCalledWith('Pipeline cancelled');
      expect(orchestrator.runPipeline).not.toHaveBeenCalled();
    });

    it('should execute status command successfully', async () => {
      // Mock CLI options
      cli.parseArguments.mockReturnValue({
        command: 'status',
        configPath: '.env',
        logPath: 'logs',
        outputPath: 'output',
        interactive: false
      });

      // Mock orchestrator status
      orchestrator.getStatus.mockReturnValue('running');
      const mockMetrics: PipelineMetrics = {
        jobsScraped: 5,
        jobsProcessed: 3,
        jobsStored: 3,
        failedScrapes: 0,
        failedProcesses: 0,
        failedStorage: 0,
        startTime: new Date(),
        endTime: new Date(),
        totalDuration: 1000,
        errors: []
      };
      orchestrator.getMetrics.mockReturnValue(mockMetrics);

      // Import and execute the CLI
      await import('../../cli/index.js');

      expect(orchestrator.getStatus).toHaveBeenCalled();
      expect(orchestrator.getMetrics).toHaveBeenCalled();
      expect(cli.showMetrics).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Mock CLI options
      cli.parseArguments.mockReturnValue({
        command: 'run',
        configPath: '.env',
        logPath: 'logs',
        outputPath: 'output',
        interactive: false
      });

      // Mock orchestrator error
      const error = new Error('Pipeline failed');
      orchestrator.runPipeline.mockRejectedValue(error);

      // Import and execute the CLI
      await import('../../cli/index.js');

      expect(cli.showError).toHaveBeenCalledWith(error);
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('Progress Tracking', () => {
    it('should update progress correctly', async () => {
      // Mock CLI options
      cli.parseArguments.mockReturnValue({
        command: 'run',
        configPath: '.env',
        logPath: 'logs',
        outputPath: 'output',
        interactive: false
      });

      // Mock orchestrator state
      orchestrator.getStatus.mockReturnValue('running');
      (orchestrator as any).state = {
        currentBatch: 5,
        totalBatches: 10,
        currentStage: 'processing'
      };

      // Import and execute the CLI
      await import('../../cli/index.js');

      // Fast-forward timers to trigger progress update
      jest.advanceTimersByTime(1000);

      expect(cli.showProgress).toHaveBeenCalledWith(5, 10, 'processing');
    });
  });
}); 