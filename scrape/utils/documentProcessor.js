import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mammoth from "mammoth";
import PDFParser from "pdf2json";
import chalk from "chalk";
import crypto from "crypto";
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

export class DocumentProcessor {
  constructor() {
    this.documentsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "database", "jobs", "files");
    this.contentDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "database", "documents");
    this.failedDocuments = [];
    this.processedDocuments = new Set();
    
    // Initialize OpenAI client
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OpenAI API key is required for structured data extraction. Please ensure OPENAI_API_KEY is set in your .env file.');
    }
    this.openai = new OpenAI({ apiKey: openaiApiKey });

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
   * @description Get the date from a jobs database filename
   * @param {string} jobsDbPath - Path to the jobs database file
   * @returns {string} Date in YYYY-MM-DD format
   */
  #getDateFromJobsFile(jobsDbPath) {
    const match = path.basename(jobsDbPath).match(/\d{4}-\d{2}-\d{2}/);
    if (!match) {
      throw new Error(`Could not extract date from jobs file: ${jobsDbPath}`);
    }
    return match[0];
  }

  /**
   * @description Extract text content from a PDF document with enhanced error handling
   * @param {string} filePath - Path to the PDF document
   * @returns {Promise<string>} Extracted text content
   */
  async #extractPdfContent(filePath) {
    console.log(chalk.blue(`  - Extracting content from PDF: ${path.basename(filePath)}`));
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser(null, 1);

      pdfParser.on("pdfParser_dataReady", pdfData => {
        try {
          const text = decodeURIComponent(pdfParser.getRawTextContent())
            .replace(/\r\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
          
          if (!text || text.length < 10) {
            console.log(chalk.red(`    ✗ Extracted content too short or empty`));
            this.failedDocuments.push({
              file: filePath,
              error: 'Extracted content appears to be empty or too short',
              type: 'pdf'
            });
            resolve(null);
          } else {
            console.log(chalk.green(`    ✓ PDF extraction complete`));
            resolve(text);
          }
        } catch (error) {
          console.log(chalk.red(`    ✗ PDF processing error: ${error.message}`));
          this.failedDocuments.push({
            file: filePath,
            error: `PDF processing error: ${error.message}`,
            type: 'pdf'
          });
          resolve(null);
        }
      });

      pdfParser.on("pdfParser_dataError", errData => {
        console.log(chalk.red(`    ✗ PDF extraction error: ${errData.parserError}`));
        this.failedDocuments.push({
          file: filePath,
          error: errData.parserError,
          type: 'pdf'
        });
        resolve(null);
      });

      try {
        pdfParser.loadPDF(filePath);
      } catch (error) {
        console.log(chalk.red(`    ✗ PDF loading error: ${error.message}`));
        this.failedDocuments.push({
          file: filePath,
          error: error.message,
          type: 'pdf'
        });
        resolve(null);
      }
    });
  }

  /**
   * @description Extract text content from a Word document with enhanced error handling
   * @param {string} filePath - Path to the Word document
   * @returns {Promise<string>} Extracted text content
   */
  async #extractWordContent(filePath) {
    console.log(chalk.blue(`  - Extracting content from Word document: ${path.basename(filePath)}`));
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      
      if (!result.value || result.value.length < 10) {
        console.log(chalk.red(`    ✗ Extracted content too short or empty`));
        this.failedDocuments.push({
          file: filePath,
          error: 'Extracted content appears to be empty or too short',
          type: 'word'
        });
        return null;
      }
      
      console.log(chalk.green(`    ✓ Word document extraction complete`));
      return result.value.trim();
    } catch (error) {
      console.log(chalk.red(`    ✗ Word extraction error: ${error.message}`));
      this.failedDocuments.push({
        file: filePath,
        error: error.message,
        type: 'word'
      });
      return null;
    }
  }

  /**
   * @description Extract structured data from text content using AI
   * @param {string} content - Raw text content from document
   * @param {object} metadata - Document metadata including job ID, filename, etc
   * @returns {Promise<object>} Structured data following MCP schema
   */
  async #extractStructuredData(content, metadata) {
    try {
      console.log(chalk.blue(`  - Extracting structured data using AI for document: ${metadata.filename}`));
      
      const prompt = `Extract structured data from the following job description document. 
Format the response as a JSON object with the following fields from the MCP schema:

- title (string): Role name
- roleId (string): Use the provided jobId
- gradeBand (string): Pay level or classification band
- division (string): Organisational unit
- cluster (string): Higher-level grouping of divisions
- agency (string): Responsible agency
- location (string): Primary office or hybrid info
- anzscoCode (string, optional): Occupational code
- pcatCode (string, optional): Public sector classification code
- dateApproved (string, optional): Role definition/update date
- primaryPurpose (string): One-paragraph summary
- keyAccountabilities (array): Bullet list of major duties
- keyChallenges (array): Bullet list of challenges
- essentialRequirements (array): Mandatory skills/qualifications
- focusCapabilities (array): Assessed capabilities with levels
- complementaryCapabilities (array): Secondary capabilities
- reportingLine (string): Who this role reports to
- directReports (string): Who this role manages
- budgetResponsibility (string, optional): Budget oversight
- sourceDocumentUrl (string): Original document URL

Document content:
${content}

Additional metadata:
Job ID: ${metadata.jobId}
Document URL: ${metadata.sourceUrl}

Return only the JSON object with the extracted data. If a field cannot be determined from the content, omit it from the JSON rather than including null or empty values.`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are a precise data extraction assistant. Extract only the requested fields from the document content. Format output as clean JSON with no additional text."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      });

      console.log(chalk.green(`    ✓ AI extraction complete`));
      const structuredData = JSON.parse(completion.choices[0].message.content);
      return structuredData;

    } catch (error) {
      console.log(chalk.red(`    ✗ Error extracting structured data: ${error.message}`));
      return null;
    }
  }

  /**
   * @description Load all previously processed documents across all dates
   * @param {string} source - The source of documents (nswgov or seek)
   * @returns {Set<string>} Set of previously processed document IDs
   */
  #loadProcessedDocuments(source) {
    const processedDocs = new Set();
    const files = fs.readdirSync(this.contentDir)
      .filter(f => f.startsWith(`${source}-docs-`) && f.endsWith('.json'));
    
    for (const file of files) {
      try {
        const documentsDb = JSON.parse(
          fs.readFileSync(path.join(this.contentDir, file), 'utf8')
        );
        
        for (const doc of documentsDb.documents) {
          processedDocs.add(doc.id);
        }
      } catch (error) {
        console.log(chalk.yellow(`Warning: Could not load documents from ${file}: ${error.message}`));
      }
    }
    
    console.log(chalk.cyan(`Loaded ${processedDocs.size} previously processed documents for ${source}`));
    return processedDocs;
  }

  /**
   * @description Process all documents from a jobs database file
   * @param {string} jobsDbPath - Path to the jobs database file
   * @returns {Promise<Array>} Array of processed document records
   */
  async processJobDocuments(jobsDbPath) {
    try {
      this.failedDocuments = [];
      const jobsData = JSON.parse(fs.readFileSync(jobsDbPath, 'utf8'));
      const documents = [];
      const processedFiles = new Set();
      
      let totalDocuments = 0;
      let currentDocument = 0;
      let skippedDocuments = 0;
      
      // Get the source and date from the filename
      const sourceMatch = path.basename(jobsDbPath).match(/(nswgov|seek)/);
      const source = sourceMatch ? sourceMatch[1] : 'unknown';
      const date = this.#getDateFromJobsFile(jobsDbPath);
      
      // Load previously processed documents from all dates
      this.processedDocuments = this.#loadProcessedDocuments(source);
      
      // Count total documents first
      for (const job of jobsData.jobs) {
        if (job.details?.documents) {
          totalDocuments += job.details.documents.length;
        }
      }

      console.log(chalk.cyan(`\nProcessing ${totalDocuments} documents from ${path.basename(jobsDbPath)}`));

      for (const job of jobsData.jobs) {
        if (!job.details?.documents) continue;

        for (const doc of job.details.documents) {
          currentDocument++;
          const documentId = this.#generateDocumentId(job.jobId, doc.filename);
          
          // Skip if document was already processed
          if (this.processedDocuments.has(documentId)) {
            console.log(chalk.yellow(`\nSkipping previously processed document [${currentDocument}/${totalDocuments}]: ${doc.filename}`));
            skippedDocuments++;
            continue;
          }
          
          if (processedFiles.has(doc.filename)) {
            console.log(chalk.yellow(`\nSkipping duplicate document [${currentDocument}/${totalDocuments}]: ${doc.filename}`));
            continue;
          }
          processedFiles.add(doc.filename);

          console.log(chalk.cyan(`\nProcessing document [${currentDocument}/${totalDocuments}]: ${doc.filename}`));
          
          const filePath = path.join(this.documentsDir, doc.filename);
          if (!fs.existsSync(filePath)) {
            console.log(chalk.red(`  ✗ File not found: ${filePath}`));
            continue;
          }

          let content = null;

          if (doc.filename.toLowerCase().endsWith('.pdf')) {
            content = await this.#extractPdfContent(filePath);
          } else if (doc.filename.toLowerCase().match(/\.docx?$/)) {
            content = await this.#extractWordContent(filePath);
          }

          if (content) {
            const structuredData = await this.#extractStructuredData(content, {
              jobId: job.jobId,
              sourceUrl: doc.url,
              filename: doc.filename
            });

            if (structuredData) {
              console.log(chalk.green(`  ✓ Document processing complete`));
            } else {
              console.log(chalk.yellow(`  ! Document processed but structured data extraction failed`));
            }

            documents.push({
              id: documentId,
              jobId: job.jobId,
              filename: doc.filename,
              type: doc.type,
              title: doc.title,
              content: content,
              structuredData: structuredData,
              metadata: {
                sourceUrl: doc.url,
                dateProcessed: new Date().toISOString(),
                fileSize: fs.statSync(filePath).size,
                mimeType: doc.filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/msword'
              }
            });

            doc.documentId = documentId;
          } else {
            console.log(chalk.red(`  ✗ Failed to extract content from document`));
          }
        }
      }

      // Save the updated jobs database with document IDs
      fs.writeFileSync(jobsDbPath, JSON.stringify(jobsData, null, 2));

      // Save the documents database with source-specific filename and the date from the jobs file
      const documentsDbPath = path.join(
        this.contentDir, 
        `${source}-docs-${date}.json`
      );
      
      // If the file exists, merge with existing documents
      let existingDocuments = [];
      if (fs.existsSync(documentsDbPath)) {
        try {
          const existing = JSON.parse(fs.readFileSync(documentsDbPath, 'utf8'));
          existingDocuments = existing.documents || [];
        } catch (error) {
          console.log(chalk.yellow(`Warning: Could not load existing documents from ${documentsDbPath}: ${error.message}`));
        }
      }
      
      fs.writeFileSync(
        documentsDbPath,
        JSON.stringify({
          metadata: {
            totalDocuments: existingDocuments.length + documents.length,
            dateProcessed: new Date().toISOString(),
            sourceJobsFile: path.basename(jobsDbPath),
            source: source
          },
          documents: [...existingDocuments, ...documents]
        }, null, 2)
      );

      // Generate failed documents report if needed
      if (this.failedDocuments.length > 0) {
        const failedDocsPath = path.join(
          this.contentDir, 
          `${source}-failed-docs-${date}.json`
        );
        
        fs.writeFileSync(
          failedDocsPath,
          JSON.stringify({
            metadata: {
              totalFailed: this.failedDocuments.length,
              dateProcessed: new Date().toISOString(),
              sourceJobsFile: path.basename(jobsDbPath),
              source: source
            },
            failedDocuments: this.failedDocuments
          }, null, 2)
        );
        
        console.log(chalk.yellow(`\nWarning: Some documents failed to process:`));
        console.log(chalk.yellow(`- Failed documents: ${this.failedDocuments.length}`));
        console.log(chalk.yellow(`- Failed documents report saved to: ${failedDocsPath}`));
      }

      console.log(chalk.green(`\nDocument processing complete:`));
      console.log(chalk.cyan(`- Processed ${documents.length} new documents`));
      console.log(chalk.cyan(`- Skipped ${skippedDocuments} previously processed documents`));
      console.log(chalk.cyan(`- Documents database saved to: ${documentsDbPath}`));
      console.log(chalk.cyan(`- Updated jobs database with document IDs`));

      return documents;
    } catch (error) {
      console.log(chalk.red(`Error processing documents: ${error.message}`));
      throw error;
    }
  }
}