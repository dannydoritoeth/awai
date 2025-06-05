/**
 * @file helpers.ts
 * @description Part of NSW Government Jobs ETL Refactoring
 * 
 * Utility helper functions used across the application.
 * 
 * @module utils
 * @see RefactorETL.md for the complete refactoring plan
 * 
 * @author AWAI Team
 * @version 1.0.0
 * @since 2024-02-06
 */

/**
 * Delay execution for a specified number of milliseconds
 */
export const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  retries: number,
  delay: number,
  backoffFactor = 2
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * backoffFactor);
  }
}

/**
 * Chunk an array into smaller arrays of specified size
 */
export function chunk<T>(array: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, i * size + size)
  );
}

/**
 * Generate a unique identifier
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format a date string to ISO format
 */
export function formatDate(date: string | Date): string {
  return new Date(date).toISOString();
}

/**
 * Sanitize a string for safe storage/display
 */
export function sanitizeString(str: string): string {
  return str
    .trim()
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const { hostname } = new URL(url);
    return hostname;
  } catch {
    return '';
  }
} 