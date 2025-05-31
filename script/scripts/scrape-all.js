import { NSWJobSpider } from "../../script/spiders/nswGovJobs.js";
import { DocumentProcessor } from "../../script/utils/documentProcessor.js";
import { generateNSWCapabilityData } from "./generateNSWCapabilities.js";
import { logger } from "../../script/utils/logger.js";
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function getInstitutionId(slug) {
  const { data, error } = await supabase
    .from('institutions')
    .select('id')
    .eq('slug', slug)
    .single();

  if (error) {
    logger.error('Error fetching institution:', error);
    throw error;
  }

  if (!data) {
    throw new Error(`Institution with slug ${slug} not found`);
  }

  return data.id;
}

/**
 * @description Runs all job spiders sequentially
 */
async function scrapeAll() {
    try {
        console.log(chalk.bold.green("Starting all job spiders..."));

        // Run NSW Government Jobs spider
        console.log(chalk.cyan("\nStarting NSW Government Jobs spider..."));
        const nswSpider = new NSWJobSpider();
        await nswSpider.launch();

        // Run Seek Jobs spider
        console.log(chalk.cyan("\nStarting Seek Jobs spider..."));
        const seekSpider = new SeekJobSpider();
        await seekSpider.launch();

        console.log(chalk.green("\nAll spiders completed successfully!"));
    } catch (error) {
        console.error(chalk.red("Error running spiders:", error));
        process.exit(1);
    }
}

async function runETLPipeline() {
  try {
    // Get institution ID from slug
    const institutionId = await getInstitutionId('nswgov');
    
    // Step 1: Initialize frameworks if needed (only once)
    logger.info('Initializing NSW Capability Framework...');
    await generateNSWCapabilityData(supabase, institutionId);
    
    // Step 2: Scrape new jobs
    logger.info('Starting NSW Government jobs spider');
    const spider = new NSWJobSpider();
    await spider.launch();
    
    // Step 3: Process documents
    logger.info('Processing documents...');
    const processor = new DocumentProcessor();
    await processor.processJobDocuments();
    
    // Step 4: Process capabilities and taxonomies
    logger.info('Processing capabilities and taxonomies...');
    // Add capability and taxonomy processing here
    
    logger.info('ETL pipeline completed successfully!');
  } catch (error) {
    logger.error('Fatal error in ETL pipeline', { error });
    process.exit(1);
  }
}

// Run the ETL pipeline
runETLPipeline();

// Run all spiders
scrapeAll(); 