import { Logger as LoggerInterface } from '../types';

/**
 * Simple logger that works in both Node.js and Deno environments
 */
export class Logger implements LoggerInterface {
  private context: string;

  constructor(context: string = 'default') {
    this.context = context;
  }

  info(message: string, data?: any): void {
    console.log(JSON.stringify({
      level: 'info',
      context: this.context,
      message,
      data,
      timestamp: new Date().toISOString()
    }));
  }

  error(message: string, error?: any): void {
    console.error(JSON.stringify({
      level: 'error',
      context: this.context,
      message,
      error: error?.message || error,
      stack: error?.stack,
      timestamp: new Date().toISOString()
    }));
  }

  warn(message: string, data?: any): void {
    console.warn(JSON.stringify({
      level: 'warn',
      context: this.context,
      message,
      data,
      timestamp: new Date().toISOString()
    }));
  }

  debug(message: string, data?: any): void {
    console.debug(JSON.stringify({
      level: 'debug',
      context: this.context,
      message,
      data,
      timestamp: new Date().toISOString()
    }));
  }
}

// Export a default logger instance
export const logger = new Logger(); 