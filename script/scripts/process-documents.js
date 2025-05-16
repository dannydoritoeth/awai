import { DocumentProcessor } from "../utils/documentProcessor.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";

async function processDocuments() {
  try {
    console.log(chalk.bold.green("Starting document processing..."));
    const processor = new DocumentProcessor();
    
    // Get the database directory
    const dbDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "database", "jobs");
    console.log(chalk.cyan(`Looking for job files in: ${dbDir}`));
    
    // List all files in the directory
    const files = fs.readdirSync(dbDir).filter(f => f.endsWith('.json'));
    console.log(chalk.cyan(`Found ${files.length} job database files`));
    
    let totalDocumentsProcessed = 0;
    
    for (const file of files) {
      if (file.startsWith('nswgov-') || file.startsWith('seek-')) {
        const jobsDbPath = path.join(dbDir, file);
        console.log(chalk.cyan(`\nProcessing documents from: ${file}`));
        
        try {
          const jobsData = JSON.parse(fs.readFileSync(jobsDbPath, 'utf8'));
          const jobCount = jobsData.jobs?.length || 0;
          const docCount = jobsData.jobs?.reduce((count, job) => count + (job.details?.documents?.length || 0), 0) || 0;
          
          console.log(chalk.cyan(`Found ${jobCount} jobs with ${docCount} documents to process`));
          
          if (docCount > 0) {
            const processedDocs = await processor.processJobDocuments(jobsDbPath);
            totalDocumentsProcessed += processedDocs.length;
          } else {
            console.log(chalk.yellow('No documents found to process in this file'));
          }
        } catch (error) {
          console.error(chalk.red(`Error processing ${file}:`, error.message));
        }
      }
    }
    
    if (totalDocumentsProcessed > 0) {
      console.log(chalk.green(`\nDocument processing completed successfully!`));
      console.log(chalk.cyan(`Total documents processed: ${totalDocumentsProcessed}`));
    } else {
      console.log(chalk.yellow('\nNo documents were processed. This could mean either:'));
      console.log(chalk.yellow('1. No job files were found with today\'s date'));
      console.log(chalk.yellow('2. No documents were found in the job files'));
      console.log(chalk.yellow('3. All documents were already processed'));
    }
  } catch (error) {
    console.error(chalk.red("Error processing documents:", error));
    process.exit(1);
  }
}

// Run the document processor
processDocuments(); 