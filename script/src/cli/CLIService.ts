/**
 * @file CLIService.ts
 * @description Part of NSW Government Jobs ETL Refactoring
 * 
 * Implementation of the CLI service.
 * This service handles command-line interface interactions
 * and argument parsing.
 * 
 * @module cli
 * @see RefactorETL.md for the complete refactoring plan
 * 
 * @author AWAI Team
 * @version 1.0.0
 * @since 2024-02-06
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { CLIService, CLIOptions, CLIArguments, CLICommand } from './types.js';
import { PipelineOptions } from '../services/orchestrator/types.js';

export class CommandLineService implements CLIService {
  private spinner = ora();
  private program: Command;

  constructor(private version: string) {
    this.program = new Command();
    this.setupCommander();
  }

  /**
   * Parse command line arguments
   */
  parseArguments(args: string[]): CLIOptions {
    this.program.parse(args);
    const options = this.program.opts<CLIArguments>();
    const command = this.program.args[0] as CLICommand || 'help';

    return {
      command,
      configPath: options.config || '.env',
      logPath: options.log || 'logs',
      outputPath: options.output || 'output',
      interactive: options.interactive ?? true,
      pipelineOptions: this.parsePipelineOptions(options)
    };
  }

  /**
   * Show help information
   */
  showHelp(): void {
    console.log(this.program.helpInformation());
    this.showSuccess('Use one of the following commands: run, status, stop, pause, resume, help');
    this.showSuccess('For more information, use --help with any command');
  }

  /**
   * Show version information
   */
  showVersion(): void {
    console.log(chalk.blue(`NSW Jobs ETL v${this.version}`));
  }

  /**
   * Show error message
   */
  showError(error: Error): void {
    this.spinner.stop();
    console.error(chalk.red('Error:'), error.message);
  }

  /**
   * Show success message
   */
  showSuccess(message: string): void {
    this.spinner.stop();
    console.log(chalk.green('✓'), message);
  }

  /**
   * Show progress indicator
   */
  showProgress(current: number, total: number, stage: string): void {
    const percentage = Math.round((current / total) * 100);
    this.spinner.text = `${stage}: ${current}/${total} (${percentage}%)`;
    
    if (!this.spinner.isSpinning) {
      this.spinner.start();
    }
  }

  /**
   * Show metrics information
   */
  showMetrics(metrics: Record<string, any>): void {
    this.spinner.stop();
    console.log(chalk.blue('\nPipeline Metrics:'));
    
    Object.entries(metrics).forEach(([key, value]) => {
      if (typeof value === 'object') {
        console.log(chalk.yellow(`\n${key}:`));
        Object.entries(value).forEach(([subKey, subValue]) => {
          console.log(`  ${chalk.cyan(subKey)}: ${subValue}`);
        });
      } else {
        console.log(`${chalk.cyan(key)}: ${value}`);
      }
    });
  }

  /**
   * Prompt for user input
   */
  async prompt(question: string): Promise<string> {
    const { answer } = await inquirer.prompt([{
      type: 'input',
      name: 'answer',
      message: question
    }]);
    return answer;
  }

  /**
   * Confirm action with user
   */
  async confirm(message: string): Promise<boolean> {
    const { confirmed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message,
      default: false
    }]);
    return confirmed;
  }

  /**
   * Select from choices
   */
  async select<T>(message: string, choices: T[]): Promise<T> {
    const { selected } = await inquirer.prompt([{
      type: 'list',
      name: 'selected',
      message,
      choices
    }]);
    return selected;
  }

  /**
   * Setup commander program
   */
  private setupCommander(): void {
    this.program
      .version(this.version)
      .description('NSW Government Jobs ETL Pipeline')
      .argument('[command]', 'Command to execute (run, status, stop, pause, resume)')
      .option('-c, --config <path>', 'Path to config file')
      .option('-l, --log <path>', 'Path to log directory')
      .option('-o, --output <path>', 'Path to output directory')
      .option('-i, --interactive', 'Enable interactive mode')
      .option('-s, --start-date <date>', 'Start date for job scraping (YYYY-MM-DD)')
      .option('-e, --end-date <date>', 'End date for job scraping (YYYY-MM-DD)')
      .option('-a, --agencies <agencies...>', 'Filter by agencies')
      .option('--locations <locations...>', 'Filter by locations')
      .option('--skip-processing', 'Skip job processing')
      .option('--skip-storage', 'Skip job storage')
      .option('--continue-on-error', 'Continue pipeline on errors')
      .option('-m, --max-records <number>', 'Maximum number of records to process (0 for all)', '0');
  }

  /**
   * Parse pipeline options from CLI arguments
   */
  private parsePipelineOptions(args: CLIArguments): PipelineOptions | undefined {
    const hasOptions = args.startDate || args.endDate || args.agencies || 
      args.locations || args.skipProcessing || args.skipStorage || args.continueOnError || args.maxRecords;

    if (!hasOptions) return undefined;

    const maxRecords = args.maxRecords ? parseInt(args.maxRecords.toString(), 10) : 0;

    return {
      startDate: args.startDate ? new Date(args.startDate) : undefined,
      endDate: args.endDate ? new Date(args.endDate) : undefined,
      agencies: args.agencies,
      locations: args.locations,
      skipProcessing: args.skipProcessing,
      skipStorage: args.skipStorage,
      continueOnError: args.continueOnError,
      maxRecords
    };
  }
} 