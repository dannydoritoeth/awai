/**
 * @file setup.ts
 * @description Test setup and global mocks
 * 
 * Global test setup and configuration.
 * 
 * @module tests
 * @see RefactorETL.md for the complete refactoring plan
 * 
 * @author AWAI Team
 * @version 1.0.0
 * @since 2024-02-06
 */

// Mock environment variables
process.env.NSW_JOBS_URL = 'https://test.jobs.nsw.gov.au';
process.env.OPENAI_API_KEY = 'test-api-key';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_KEY = 'test-supabase-key';
process.env.SUPABASE_STAGING_URL = 'https://test-staging.supabase.co';
process.env.SUPABASE_STAGING_KEY = 'test-staging-key';

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}; 