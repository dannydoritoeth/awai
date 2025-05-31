import { ETLProcessor } from './ETLProcessor.js';
import { NSWJobSpider } from '../spiders/nswGovJobs.js';
import { logger } from '../utils/logger.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Validate required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY || !process.env.SUPABASE_STAGING_URL || !process.env.SUPABASE_STAGING_KEY) {
    throw new Error('Missing required environment variables: SUPABASE_URL, SUPABASE_KEY, SUPABASE_STAGING_URL, and SUPABASE_STAGING_KEY must be set in .env.local');
}

// Type assertion since we validated these above
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_KEY as string;
const supabaseStagingUrl = process.env.SUPABASE_STAGING_URL as string;
const supabaseStagingKey = process.env.SUPABASE_STAGING_KEY as string;

// Define job type
type Job = {
    jobId: string;
    department: string;
    title: string;
    location: string;
    salary: string;
    closingDate: string;
    sourceUrl: string;
    source: string;
    institution: string;
};

async function runDaily() {
    try {
        // Initialize Supabase clients
        const supabase = createClient(supabaseUrl, supabaseKey);
        const stagingSupabase = createClient(supabaseStagingUrl, supabaseStagingKey);
        
        // Test Supabase connections
        const { error: testError } = await supabase.from('institutions').select('count').single();
        if (testError) {
            logger.error('Failed to connect to live Supabase:', {
                error: {
                    message: testError.message,
                    details: testError.details,
                    hint: testError.hint,
                    code: testError.code
                }
            });
            throw testError;
        }

        const { error: testStagingError } = await stagingSupabase.from('institutions').select('count').single();
        if (testStagingError) {
            logger.error('Failed to connect to staging Supabase:', {
                error: {
                    message: testStagingError.message,
                    details: testStagingError.details,
                    hint: testStagingError.hint,
                    code: testStagingError.code
                }
            });
            throw testStagingError;
        }
        
        // Get or create NSW Gov institution in both databases
        let { data: institution, error: institutionError } = await supabase
            .from('institutions')
            .select('id')
            .eq('slug', 'nsw-gov')
            .single();
            
        if (institutionError && institutionError.code === 'PGRST116') {
            // Institution doesn't exist, create it
            const { data: newInstitution, error: createError } = await supabase
                .from('institutions')
                .insert({
                    name: 'NSW Government',
                    slug: 'nsw-gov',
                    description: 'New South Wales Government',
                    website_url: 'https://www.nsw.gov.au'
                })
                .select('id')
                .single();
                
            if (createError) {
                logger.error('Error creating institution in live database:', {
                    error: {
                        message: createError.message,
                        details: createError.details,
                        hint: createError.hint,
                        code: createError.code
                    }
                });
                throw createError;
            }
            
            institution = newInstitution;
            logger.info('Created NSW Gov institution in live database');
        } else if (institutionError) {
            logger.error('Error fetching institution from live database:', {
                error: {
                    message: institutionError.message,
                    details: institutionError.details,
                    hint: institutionError.hint,
                    code: institutionError.code
                }
            });
            throw institutionError;
        }

        // Create or update the institution in staging database
        if (!institution) {
            const error = new Error('NSW Gov institution not found and could not be created in live database');
            logger.error(error.message);
            throw error;
        }

        const { data: stagingInstitution, error: stagingInstitutionError } = await stagingSupabase
            .from('institutions')
            .upsert({
                id: institution.id,
                name: 'NSW Government',
                slug: 'nsw-gov',
                description: 'New South Wales Government',
                website_url: 'https://www.nsw.gov.au'
            })
            .select('id')
            .single();

        if (stagingInstitutionError) {
            logger.error('Error upserting institution in staging database:', {
                error: {
                    message: stagingInstitutionError.message,
                    details: stagingInstitutionError.details,
                    hint: stagingInstitutionError.hint,
                    code: stagingInstitutionError.code
                }
            });
            throw stagingInstitutionError;
        }
        
        // Initialize ETL processor with both database connections
        const processor = new ETLProcessor({
            maxJobs: 1,
            supabase,
            institution_id: institution.id
        });
        
        // Initialize spider with staging database connection
        const spider = new NSWJobSpider({
            maxJobs: 1,
            supabase: stagingSupabase,
            institution_id: institution.id
        });
        
        // Run the spider to get jobs
        logger.info('Starting NSW Government jobs spider');
        const jobs = await spider.launch() as Job[];
        
        if (!jobs || jobs.length === 0) {
            logger.warn('No jobs found to process');
            return;
        }
        
        logger.info(`Found ${jobs.length} jobs to process`);
        
        // Deduplicate jobs by jobId
        const uniqueJobs = Array.from(
            jobs.reduce((map, job) => {
                if (!map.has(job.jobId)) {
                    map.set(job.jobId, job);
                }
                return map;
            }, new Map<string, Job>()).values()
        );
        
        logger.info(`Found ${uniqueJobs.length} unique jobs after deduplication`);
        
        // Group jobs by department
        const departmentJobs = new Map<string, Job[]>();
        for (const job of uniqueJobs) {
            if (!departmentJobs.has(job.department)) {
                departmentJobs.set(job.department, []);
            }
            departmentJobs.get(job.department)!.push(job);
        }
        
        // The jobs have already been processed by the spider, no need to process them again
        logger.info('Daily ETL run completed successfully');
    } catch (error) {
        // Ensure error is properly formatted
        const formattedError = error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
            cause: error.cause
        } : error;
        
        logger.error('Fatal error in daily ETL run:', { error: formattedError });
        process.exit(1);
    }
}

// Add proper error handling for the main execution
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection:', {
        reason: reason instanceof Error ? {
            name: reason.name,
            message: reason.message,
            stack: reason.stack,
            cause: reason.cause
        } : reason
    });
    process.exit(1);
});

runDaily().catch(error => {
    const formattedError = error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause
    } : error;
    
    logger.error('Unhandled error in daily ETL run:', { error: formattedError });
    process.exit(1);
}); 