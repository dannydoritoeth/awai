#!/usr/bin/env node

/**
 * @file runDaily.js
 * @description Daily ETL job runner for NSW Government Jobs
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const cliPath = path.resolve(projectRoot, 'src', 'cli', 'index.ts');
const tsNodePath = path.resolve(projectRoot, 'node_modules', '.bin', 'ts-node');

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
  NSW_JOBS_URL: 'NSW Government jobs portal URL'
};

// Check for missing environment variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([key]) => !process.env[key])
  .map(([key, desc]) => `${key} (${desc})`);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:\n', missingVars.join('\n'));
  process.exit(1);
}

// Log environment status (safely)
console.log('Environment loaded:', {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'Set' : 'Not Set',
  SUPABASE_STAGING_URL: process.env.SUPABASE_STAGING_URL ? 'Set' : 'Not Set',
  SUPABASE_STAGING_KEY: process.env.SUPABASE_STAGING_KEY ? 'Set' : 'Not Set',
  SUPABASE_LIVE_URL: process.env.SUPABASE_LIVE_URL ? 'Set' : 'Not Set',
  SUPABASE_LIVE_KEY: process.env.SUPABASE_LIVE_KEY ? 'Set' : 'Not Set',
  NSW_JOBS_URL: process.env.NSW_JOBS_URL ? 'Set' : 'Not Set'
});

// Ensure we're in the project root directory
process.chdir(projectRoot);

console.log('Starting ETL pipeline...');
console.log('Project Root:', projectRoot);
console.log('CLI Path:', cliPath);

// Pipeline options from environment variables or defaults
const pipelineOptions = [
  '--max-records', process.env.MAX_RECORDS || '0',
  '--batch-size', process.env.BATCH_SIZE || '10',
  '--retry-attempts', process.env.RETRY_ATTEMPTS || '3',
  '--retry-delay', process.env.RETRY_DELAY || '1000',
  '--continue-on-error'
];

// Run the CLI script with output piping
const child = spawn(
  process.platform === 'win32' ? `${tsNodePath}.cmd` : tsNodePath,
  [
    '--esm',
    cliPath,
    'run',
    ...pipelineOptions
  ],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      ...envConfig.parsed,
      NODE_OPTIONS: '--loader ts-node/esm'
    }
  }
);

// Capture stdout
child.stdout.on('data', (data) => {
  console.log(data.toString());
});

// Capture stderr
child.stderr.on('data', (data) => {
  console.error('Error output:', data.toString());
});

// Handle process events
child.on('error', (error) => {
  console.error('Failed to start process:', error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Process terminated with signal: ${signal}`);
    process.exit(1);
  }
  if (code !== 0) {
    console.error(`Process exited with code: ${code}`);
    process.exit(code);
  }
  process.exit(0);
}); 