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
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    throw new Error('Missing required environment variables: SUPABASE_URL and SUPABASE_KEY must be set in .env.local');
}

// Type assertion since we validated these above
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_KEY as string;

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
        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Get or create NSW Gov institution
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
                logger.error('Error creating institution:', createError);
                throw createError;
            }
            
            institution = newInstitution;
            logger.info('Created NSW Gov institution');
        } else if (institutionError) {
            logger.error('Error fetching institution:', institutionError);
            throw institutionError;
        }
        
        if (!institution) {
            logger.error('NSW Gov institution not found and could not be created');
            throw new Error('NSW Gov institution not found and could not be created');
        }
        
        // Initialize ETL processor
        const processor = new ETLProcessor();
        
        // Initialize spider with desired job limit
        const spider = new NSWJobSpider();
        
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
        
        // Process the jobs through ETL
        logger.info('Processing jobs through ETL');
        await processor.processInstitution(institution.id, Array.from(departmentJobs.entries()).map(([name, jobs]) => ({
            name,
            jobs
        })));
        
        logger.info('Daily ETL run completed successfully');
    } catch (error) {
        logger.error('Fatal error in daily ETL run', { error });
        process.exit(1);
    }
}

runDaily().catch(error => {
    logger.error('Unhandled error in daily ETL run', { error });
    process.exit(1);
}); 