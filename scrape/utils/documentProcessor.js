import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mammoth from "mammoth";
import PDFParser from "pdf2json";
import chalk from "chalk";
import crypto from "crypto";

export class DocumentProcessor {
  constructor() {
    this.documentsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "database", "jobs", "files");
    this.contentDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "database", "documents");
    
    // Ensure the content directory exists
    if (!fs.existsSync(this.contentDir)) {
      fs.mkdirSync(this.contentDir, { recursive: true });
    }
  }

  /**
   * @description Generate a unique ID for a document
   * @param {string} jobId - The job ID
   * @param {string} filename - The document filename
   * @returns {string} A unique document ID
   */
  #generateDocumentId(jobId, filename) {
    const hash = crypto.createHash('sha256');
    hash.update(`${jobId}-${filename}`);
    return hash.digest('hex').substring(0, 24); // Use first 24 chars for a manageable ID
  }

  /**
   * @description Format today's date for the filename
   * @returns {string} Formatted date string
   */
  #getTodayDate() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // First try to find files with today's date
    const todayStr = `${year}-${month}-${day}`;
    const dbDir = path.join(this.contentDir, '..', 'jobs');
    
    // Look for any job files that exist
    const files = fs.readdirSync(dbDir).filter(f => f.endsWith('.json'));
    if (files.length > 0) {
      // Extract the date from the first file
      const match = files[0].match(/\d{4}-\d{2}-\d{2}/);
      if (match) {
        return match[0];
      }
    }
    
    return todayStr;
  }

  /**
   * @description Extract text content from a Word document
   * @param {string} filePath - Path to the Word document
   * @returns {Promise<string>} Extracted text content
   */
  async #extractWordContent(filePath) {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch (error) {
      console.log(chalk.yellow(`Error extracting Word content from ${filePath}: ${error.message}`));
      return null;
    }
  }

  /**
   * @description Extract text content from a PDF document
   * @param {string} filePath - Path to the PDF document
   * @returns {Promise<string>} Extracted text content
   */
  async #extractPdfContent(filePath) {
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser();

      pdfParser.on("pdfParser_dataReady", pdfData => {
        try {
          // Convert PDF to text and decode URI-encoded characters
          const text = decodeURIComponent(pdfParser.getRawTextContent());
          resolve(text);
        } catch (error) {
          console.log(chalk.yellow(`Error processing PDF content from ${filePath}: ${error.message}`));
          resolve(null);
        }
      });

      pdfParser.on("pdfParser_dataError", errData => {
        console.log(chalk.yellow(`Error extracting PDF content from ${filePath}: ${errData.parserError}`));
        resolve(null);
      });

      try {
        pdfParser.loadPDF(filePath);
      } catch (error) {
        console.log(chalk.yellow(`Error loading PDF from ${filePath}: ${error.message}`));
        resolve(null);
      }
    });
  }

  /**
   * @description Process all documents from a jobs database file
   * @param {string} jobsDbPath - Path to the jobs database file
   * @returns {Promise<Array>} Array of processed document records
   */
  async processJobDocuments(jobsDbPath) {
    try {
      // Read the jobs database
      const jobsData = JSON.parse(fs.readFileSync(jobsDbPath, 'utf8'));
      const documents = [];
      const processedFiles = new Set();

      // Process each job's documents
      for (const job of jobsData.jobs) {
        if (!job.details?.documents) continue;

        for (const doc of job.details.documents) {
          // Skip if we've already processed this file
          if (processedFiles.has(doc.filename)) continue;
          processedFiles.add(doc.filename);

          const filePath = path.join(this.documentsDir, doc.filename);
          if (!fs.existsSync(filePath)) {
            console.log(chalk.yellow(`File not found: ${filePath}`));
            continue;
          }

          // Generate a unique document ID
          const documentId = this.#generateDocumentId(job.jobId, doc.filename);

          // Extract content based on file type
          let content = null;
          if (doc.filename.toLowerCase().endsWith('.pdf')) {
            content = await this.#extractPdfContent(filePath);
          } else if (doc.filename.toLowerCase().match(/\.docx?$/)) {
            content = await this.#extractWordContent(filePath);
          }

          if (content) {
            documents.push({
              id: documentId,
              jobId: job.jobId,
              filename: doc.filename,
              type: doc.type,
              title: doc.title,
              content: content,
              metadata: {
                sourceUrl: doc.url,
                dateProcessed: new Date().toISOString(),
                fileSize: fs.statSync(filePath).size,
                mimeType: doc.filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/msword'
              }
            });

            // Update the job's document reference with the document ID
            doc.documentId = documentId;
          }
        }
      }

      // Save the updated jobs database with document IDs
      fs.writeFileSync(jobsDbPath, JSON.stringify(jobsData, null, 2));

      // Save the documents database
      const documentsDbPath = path.join(this.contentDir, `documents-${this.#getTodayDate()}.json`);
      fs.writeFileSync(
        documentsDbPath,
        JSON.stringify({
          metadata: {
            totalDocuments: documents.length,
            dateProcessed: new Date().toISOString(),
            sourceJobsFile: path.basename(jobsDbPath)
          },
          documents: documents
        }, null, 2)
      );

      console.log(chalk.green(`\nDocument processing complete:`));
      console.log(chalk.cyan(`- Processed ${documents.length} documents`));
      console.log(chalk.cyan(`- Documents database saved to: ${documentsDbPath}`));
      console.log(chalk.cyan(`- Updated jobs database with document IDs`));

      return documents;
    } catch (error) {
      console.log(chalk.red(`Error processing documents: ${error.message}`));
      throw error;
    }
  }
} 