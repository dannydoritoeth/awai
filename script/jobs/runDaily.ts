import { ETLProcessor } from './ETLProcessor.js';
import { logger } from '../utils/logger.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { NSWJobSpider } from '../spiders/nswGovJobs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Validate required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    throw new Error('Missing required environment variables: SUPABASE_URL and SUPABASE_KEY must be set in .env.local');
}

async function runDaily() {
    // Type assertion since we validated these above
    const supabaseUrl = process.env.SUPABASE_URL as string;
    const supabaseKey = process.env.SUPABASE_KEY as string;

    logger.info('Initializing Supabase client', { url: supabaseUrl });
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // First run the NSW Gov spider to get latest jobs
        logger.info('Starting NSW Government Jobs spider');
        const spider = new NSWJobSpider();
        await spider.launch();
        logger.info('NSW Government Jobs spider completed successfully');

        // Now process the scraped data
        logger.info('Fetching institutions');
        const { data: institutions, error } = await supabase
            .from('institutions')
            .select('*');

        if (error) {
            logger.error('Supabase query error:', {
                message: error.message,
                details: error.details,
                hint: error.hint
            });
            throw error;
        }

        if (!institutions || institutions.length === 0) {
            logger.warn('No institutions found');
            return;
        }

        logger.info(`Starting daily ETL run for ${institutions.length} institutions`);

        const processor = new ETLProcessor();

        // Process each institution
        for (const institution of institutions) {
            try {
                logger.info(`Processing institution: ${institution.name}`);
                await processor.processInstitution(institution.id);
                logger.info(`Completed processing for institution: ${institution.name}`);
            } catch (error) {
                logger.error(`Error processing institution ${institution.name}`, {
                    error: error instanceof Error ? error.message : String(error),
                    institutionId: institution.id,
                    stack: error instanceof Error ? error.stack : undefined
                });
                // Continue with next institution despite errors
            }
        }

        logger.info('Daily ETL run completed successfully');
    } catch (error) {
        const errorDetails = error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
            cause: error.cause
        } : { message: String(error) };

        logger.error('Fatal error in daily ETL run', { error: errorDetails });
        process.exit(1);
    }
}

// If running directly (not imported as a module)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runDaily()
        .then(() => process.exit(0))
        .catch((error) => {
            const errorDetails = error instanceof Error ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
                cause: error.cause
            } : { message: String(error) };

            logger.error('Unhandled error in daily ETL run', { error: errorDetails });
            process.exit(1);
        });
}

export { runDaily }; 