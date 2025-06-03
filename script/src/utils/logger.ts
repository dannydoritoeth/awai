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

export interface Logger {
  info(message: string, data?: any): void;
  error(message: string, error?: any): void;
  warn(message: string, data?: any): void;
  debug(message: string, data?: any): void;
}

export class ConsoleLogger implements Logger {
  constructor(private context: string = 'ETL') {}

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${this.context}] ${message}`;
  }

  private formatData(data: any): string {
    if (!data) return '';
    try {
      // Clone the data to avoid modifying the original
      const sanitizedData = JSON.parse(JSON.stringify(data));
      
      // Remove embedding fields recursively
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

  info(message: string, data?: any): void {
    console.log(this.formatMessage('INFO', message));
    if (data) console.log(this.formatData(data));
  }

  error(message: string, error?: any): void {
    console.error(this.formatMessage('ERROR', message));
    if (error) {
      if (error instanceof Error) {
        console.error(error.stack);
      } else {
        console.error(this.formatData(error));
      }
    }
  }

  warn(message: string, data?: any): void {
    console.warn(this.formatMessage('WARN', message));
    if (data) console.warn(this.formatData(data));
  }

  debug(message: string, data?: any): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('DEBUG', message));
      if (data) console.debug(this.formatData(data));
    }
  }
}

// Export a default logger instance
export const logger = new ConsoleLogger(); 