/**
 * @file types.ts
 * @description Part of NSW Government Jobs ETL Refactoring
 * 
 * Types and interfaces for the CLI interface.
 * 
 * @module cli
 * @see RefactorETL.md for the complete refactoring plan
 * 
 * @author AWAI Team
 * @version 1.0.0
 * @since 2024-02-06
 */

import { PipelineOptions } from '../services/orchestrator/types.js';

export interface CLIConfig {
  configPath: string;
  logPath: string;
  outputPath: string;
  interactive: boolean;
}

export interface CLIOptions extends CLIConfig {
  command: CLICommand;
  pipelineOptions?: PipelineOptions;
}

export type CLICommand = 
  | 'run'    // Run the pipeline
  | 'status' // Get pipeline status
  | 'stop'   // Stop the pipeline
  | 'pause'  // Pause the pipeline
  | 'resume' // Resume the pipeline
  | 'help';  // Show help

export interface CLIArguments {
  [key: string]: unknown;
  config?: string;
  log?: string;
  output?: string;
  interactive?: boolean;
  startDate?: string;
  endDate?: string;
  agencies?: string[];
  locations?: string[];
  skipProcessing?: boolean;
  skipStorage?: boolean;
  continueOnError?: boolean;
  maxRecords?: string | number;  // Can be either string from CLI or number after parsing
}

export interface CLIService {
  parseArguments(args: string[]): CLIOptions;
  showHelp(): void;
  showVersion(): void;
  showError(error: Error): void;
  showSuccess(message: string): void;
  showProgress(current: number, total: number, stage: string): void;
  showMetrics(metrics: Record<string, any>): void;
  prompt(question: string): Promise<string>;
  confirm(message: string): Promise<boolean>;
  select<T>(message: string, choices: T[]): Promise<T>;
} 