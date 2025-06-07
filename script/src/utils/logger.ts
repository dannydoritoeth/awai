/**
 * @file logger.ts
 * @description Part of NSW Government Jobs ETL Refactoring
 * 
 * Logging utility for consistent logging across the application.
 * This maintains the same logging interface as the current implementation
 * to ensure consistent logging during refactoring.
 * 
 * @module utils
 * @see RefactorETL.md for the complete refactoring plan
 * 
 * @author AWAI Team
 * @version 1.0.0
 * @since 2024-02-06
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current file info in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Constants for file paths
const OUT_DIR = path.join(process.cwd(), 'out');
const LOG_FILE_PATH_STORE = path.join(OUT_DIR, '.current-log-file');

// Ensure the out directory exists
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// Clean up any existing .current-log-file at startup
try {
  fs.rmSync(LOG_FILE_PATH_STORE, { force: true });
} catch (error) {
  // Ignore any errors during cleanup
}

function createLogFile(): string | null {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(OUT_DIR, `etl-${timestamp}.log`);
  
  try {
    // Try to atomically create the .current-log-file
    // This will fail if the file already exists
    fs.writeFileSync(LOG_FILE_PATH_STORE, logFile, { flag: 'wx' });
    
    // Create the actual log file
    fs.writeFileSync(logFile, '');
    return logFile;
  } catch (error) {
    // If we couldn't create the pointer file, someone else probably did
    return null;
  }
}

function getCurrentLogFile(): string {
  try {
    // Try to read the current log file path
    if (fs.existsSync(LOG_FILE_PATH_STORE)) {
      const content = fs.readFileSync(LOG_FILE_PATH_STORE, 'utf8');
      if (content && fs.existsSync(content)) {
        return content;
      }
    }

    // If we get here, we need to create a new log file
    let logFile = createLogFile();
    
    // If we couldn't create it, someone else might have just created it
    // Wait a bit and try reading again
    if (!logFile) {
      // Wait up to 5 seconds for the file to be created
      for (let i = 0; i < 50; i++) {
        if (fs.existsSync(LOG_FILE_PATH_STORE)) {
          const content = fs.readFileSync(LOG_FILE_PATH_STORE, 'utf8');
          if (content && fs.existsSync(content)) {
            return content;
          }
        }
        // Wait 100ms between checks
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
      }
      
      // If we still don't have a file, force create one
      fs.rmSync(LOG_FILE_PATH_STORE, { force: true });
      logFile = createLogFile();
      if (!logFile) {
        throw new Error('Failed to create log file after multiple attempts');
      }
    }
    
    return logFile;
  } catch (error) {
    throw error;
  }
}

export interface Logger {
  info(message: string, data?: any): void;
  error(message: string, error?: any): void;
  warn(message: string, data?: any): void;
  debug(message: string, data?: any): void;
  logStartupBanner(options: any): void;
}

export class ConsoleLogger implements Logger {
  private logFile: string;
  private logStream: fs.WriteStream;
  private static instance: ConsoleLogger;

  private constructor(private context: string = 'ETL') {
    // Get or create the log file
    this.logFile = getCurrentLogFile();

    // Create or open the log file stream
    this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
  }

  public static getInstance(context: string = 'ETL'): ConsoleLogger {
    if (!ConsoleLogger.instance) {
      ConsoleLogger.instance = new ConsoleLogger(context);
    }
    return ConsoleLogger.instance;
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${this.context}] [PID:${process.pid}] ${message}`;
  }

  private formatData(data: any): string {
    if (!data) return '';
    try {
      const sanitizedData = JSON.parse(JSON.stringify(data));
      const removeEmbeddings = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        for (const key in obj) {
          if (key === 'embedding' || key === 'embeddings' || key === 'vector') {
            obj[key] = '[vector data hidden]';
          } else if (typeof obj[key] === 'object') {
            removeEmbeddings(obj[key]);
          }
        }
      };
      removeEmbeddings(sanitizedData);
      return typeof sanitizedData === 'string' ? sanitizedData : JSON.stringify(sanitizedData, null, 2);
    } catch (error) {
      return String(data);
    }
  }

  private writeToFile(message: string): void {
    if (this.logStream && this.logStream.writable) {
      this.logStream.write(message + '\n');
    }
  }

  logStartupBanner(options: any): void {
    const banner = [
      '='.repeat(80),
      'ETL Pipeline Startup Configuration',
      '='.repeat(80),
      '',
      `Project Root: ${process.cwd()}`,
      `Environment File: ${path.join(process.cwd(), '.env.local')}`,
      `Log File: ${this.logFile}`,
      '',
      'Environment Variables:',
      Object.entries(process.env)
        .filter(([key]) => [
          'OPENAI_API_KEY',
          'SUPABASE_STAGING_URL',
          'SUPABASE_STAGING_KEY',
          'SUPABASE_LIVE_URL',
          'SUPABASE_LIVE_KEY',
          'NSW_JOBS_URL',
          'PG_STAGING_URL',
          'SCRAPE_ONLY'
        ].includes(key))
        .map(([key, value]) => `  ${key}: ${value ? 'Set' : 'Not Set'}`)
        .join('\n'),
      '',
      'Pipeline Options:',
      JSON.stringify(options, null, 2),
      '',
      '='.repeat(80),
      ''
    ].join('\n');

    this.writeToFile(banner);
    console.log(banner);
  }

  info(message: string, data?: any): void {
    const formattedMessage = this.formatMessage('INFO', message);
    console.log(formattedMessage);
    this.writeToFile(formattedMessage);
    
    if (data) {
      const formattedData = this.formatData(data);
      console.log(formattedData);
      this.writeToFile(formattedData);
    }
  }

  error(message: string, error?: any): void {
    const formattedMessage = this.formatMessage('ERROR', message);
    console.error(formattedMessage);
    this.writeToFile(formattedMessage);
    
    if (error) {
      if (error instanceof Error) {
        console.error(error.stack);
        this.writeToFile(error.stack || error.message);
      } else {
        const formattedError = this.formatData(error);
        console.error(formattedError);
        this.writeToFile(formattedError);
      }
    }
  }

  warn(message: string, data?: any): void {
    const formattedMessage = this.formatMessage('WARN', message);
    console.warn(formattedMessage);
    this.writeToFile(formattedMessage);
    
    if (data) {
      const formattedData = this.formatData(data);
      console.warn(formattedData);
      this.writeToFile(formattedData);
    }
  }

  debug(message: string, data?: any): void {
    if (process.env.NODE_ENV === 'development') {
      const formattedMessage = this.formatMessage('DEBUG', message);
      console.debug(formattedMessage);
      this.writeToFile(formattedMessage);
      
      if (data) {
        const formattedData = this.formatData(data);
        console.debug(formattedData);
        this.writeToFile(formattedData);
      }
    }
  }

  cleanup(): void {
    if (this.logStream) {
      this.logStream.end();
    }
    // Clean up the .current-log-file
    try {
      fs.rmSync(LOG_FILE_PATH_STORE, { force: true });
    } catch (error) {
      // Ignore any errors during cleanup
    }
  }
}

// Create the logger instance
const logger = ConsoleLogger.getInstance();

// Cleanup handlers
const cleanupHandler = () => {
  if (logger instanceof ConsoleLogger) {
    logger.cleanup();
  }
};

process.on('exit', cleanupHandler);
process.on('SIGINT', () => {
  cleanupHandler();
  process.exit();
});

process.on('SIGTERM', () => {
  cleanupHandler();
  process.exit();
});

export { logger }; 