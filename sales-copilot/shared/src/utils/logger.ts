import { Logger as LoggerInterface } from '../types';

/**
 * Simple logger that works in both Node.js and Deno environments
 */
export class Logger implements LoggerInterface {
  constructor(private logLevel: string = 'info') {}

  info(message: string, data?: any): void {
    if (this.logLevel === 'none') return;
    
    if (data) {
      console.log(`INFO: ${message}`, data);
    } else {
      console.log(`INFO: ${message}`);
    }
  }

  error(message: string, error?: any): void {
    if (this.logLevel === 'none') return;
    
    if (error) {
      console.error(`ERROR: ${message}`, error);
    } else {
      console.error(`ERROR: ${message}`);
    }
  }
}

// Export a default logger instance
export const logger = new Logger(); 