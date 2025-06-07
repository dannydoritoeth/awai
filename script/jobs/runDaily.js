#!/usr/bin/env node

/**
 * @file runDaily.js
 * @description Daily ETL job runner for NSW Government Jobs
 */

import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const cliPath = path.resolve(projectRoot, 'src', 'cli', 'index.ts');

// Load environment variables
const envPath = path.resolve(projectRoot, '.env.local');
console.log('Loading env from:', envPath);
const envConfig = dotenv.config({ path: envPath });

if (envConfig.error) {
  console.error('Error loading .env.local:', envConfig.error);
  process.exit(1);
}

// Required environment variables
const requiredEnvVars = {
  OPENAI_API_KEY: 'OpenAI API key for job analysis',
  SUPABASE_STAGING_URL: 'Supabase staging database URL',
  SUPABASE_STAGING_KEY: 'Supabase staging database key',
  SUPABASE_LIVE_URL: 'Supabase live database URL',
  SUPABASE_LIVE_KEY: 'Supabase live database key',
  NSW_JOBS_URL: 'NSW Government jobs portal URL',
  PG_STAGING_URL: 'PostgreSQL connection string for staging database'
};

// Optional environment variables with defaults
const optionalEnvVars = {
  MAX_RECORDS: '0',
  BATCH_SIZE: '10',
  RETRY_ATTEMPTS: '3',
  RETRY_DELAY: '1000',
  SCRAPE_ONLY: 'false'
};

// Set default values for optional variables
Object.entries(optionalEnvVars).forEach(([key, defaultValue]) => {
  if (!process.env[key]) {
    process.env[key] = defaultValue;
  }
});

// Check for missing environment variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([key]) => !process.env[key])
  .map(([key, desc]) => `${key} (${desc})`);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:\n', missingVars.join('\n'));
  process.exit(1);
}

// Initialize PostgreSQL connection pool
const pgStagingPool = new pg.Pool({
  connectionString: process.env.PG_STAGING_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Supabase
  },
});

// Test PostgreSQL connection
async function testPgConnection() {
  let client;
  try {
    console.log('\n=== Testing PostgreSQL Connection ===');
    client = await pgStagingPool.connect();
    
    // Get PostgreSQL version and connection info
    const { rows: versionRows } = await client.query('SELECT version()');
    const { rows: connectionRows } = await client.query(
      "SELECT current_database(), current_user, inet_server_addr() as server_ip, inet_server_port() as server_port"
    );

    console.log('PostgreSQL Version:', versionRows[0].version);
    console.log('Connection Info:', {
      database: connectionRows[0].current_database,
      user: connectionRows[0].current_user,
      server: `${connectionRows[0].server_ip}:${connectionRows[0].server_port}`
    });
    
    // Test a simple table count query
    const { rows: tableRows } = await client.query(
      "SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public'"
    );
    console.log('\nAvailable tables in public schema:', tableRows.length);
    tableRows.forEach(row => console.log(`- ${row.tablename}`));
    
    console.log('\nPostgreSQL connection test successful!');
    console.log('=====================================\n');
  } catch (error) {
    console.error('\nError connecting to PostgreSQL staging database:', error);
    console.log('Continuing with Supabase connection only');
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Log loaded environment variables
console.log('Environment loaded:', {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'Set' : 'Not set',
  SUPABASE_STAGING_URL: process.env.SUPABASE_STAGING_URL ? 'Set' : 'Not set',
  SUPABASE_STAGING_KEY: process.env.SUPABASE_STAGING_KEY ? 'Set' : 'Not set',
  SUPABASE_LIVE_URL: process.env.SUPABASE_LIVE_URL ? 'Set' : 'Not set',
  SUPABASE_LIVE_KEY: process.env.SUPABASE_LIVE_KEY ? 'Set' : 'Not set',
  NSW_JOBS_URL: process.env.NSW_JOBS_URL ? 'Set' : 'Not set',
  PG_STAGING_URL: process.env.PG_STAGING_URL ? 'Set' : 'Not set',
  SCRAPE_ONLY: process.env.SCRAPE_ONLY
});

// Ensure we're in the project root directory
process.chdir(projectRoot);

console.log('Starting ETL pipeline...');
console.log('Project Root:', projectRoot);
console.log('CLI Path:', cliPath);

// Test PostgreSQL connection before proceeding
await testPgConnection();

// Pipeline options from environment variables or defaults
const pipelineOptions = [
  '--max-records', process.env.MAX_RECORDS || '0',
  '--batch-size', process.env.BATCH_SIZE || '10',
  '--retry-attempts', process.env.RETRY_ATTEMPTS || '3',
  '--retry-delay', process.env.RETRY_DELAY || '1000',
  '--continue-on-error',
  process.env.SCRAPE_ONLY === 'true' ? '--scrape-only' : ''
].filter(Boolean).join(' ');

// Log the pipeline options being used
console.log('Pipeline options:', pipelineOptions);

try {
  // Run the CLI script using execSync
  execSync(`npx ts-node --esm "${cliPath}" run ${pipelineOptions}`, {
    cwd: projectRoot,
    env: {
      ...process.env,
      ...envConfig.parsed,
      NODE_OPTIONS: '--loader ts-node/esm'
    },
    stdio: 'inherit'
  });
} catch (error) {
  console.error('Failed to run ETL pipeline:', error);
  process.exit(1);
} finally {
  // Clean up PostgreSQL connection pool
  await pgStagingPool.end();
}