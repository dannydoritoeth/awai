import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mammoth from "mammoth";
import PDFParser from "pdf2json";
import chalk from "chalk";
import crypto from "crypto";
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

export class DocumentProcessor {
  #supabase;
  #institutionId;

  constructor(supabase, institutionId) {
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

    // Initialize Supabase client
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      throw new Error('Supabase credentials are required. Please ensure SUPABASE_URL and SUPABASE_KEY are set in your .env file.');
    }
    this.#supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    // Ensure the content directory exists
    if (!fs.existsSync(this.contentDir)) {
      fs.mkdirSync(this.contentDir, { recursive: true });
    }

    this.#institutionId = institutionId;
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
- skills (array): List of specific skills required for this role, extracted from the entire document content. Include both technical and soft skills. Each skill should be a string representing a distinct, well-defined skill (e.g. "Python Programming", "Stakeholder Management", "Data Analysis", "Project Management", etc.)

Document content:
${content}

Additional metadata:
Job ID: ${metadata.jobId}
Document URL: ${metadata.sourceUrl}

Return only the JSON object with the extracted data. If a field cannot be determined from the content, omit it from the JSON rather than including null or empty values. For the skills array, be comprehensive and extract all relevant skills mentioned throughout the document, including those implied by the responsibilities and requirements.`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
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
   * @description Get or create the NSW Government institution
   * @returns {Promise<string>} Institution ID
   */
  async #getOrCreateInstitution() {
    const slug = 'nsw-gov';
    const { data: institution, error: fetchError } = await this.#supabase
      .from('institutions')
      .select('id')
      .eq('slug', slug)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found" error
      throw fetchError;
    }

    if (institution) {
      return institution.id;
    }

    // Create the institution if it doesn't exist
    const { data: newInstitution, error: insertError } = await this.#supabase
      .from('institutions')
      .insert({
        name: 'NSW Government',
        slug: slug,
        description: 'New South Wales Government Departments and Agencies',
        website_url: 'https://www.nsw.gov.au'
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return newInstitution.id;
  }

  /**
   * @description Process documents from a jobs database file
   * @param {string} jobsDbPath - Path to the jobs database file
   * @returns {Promise<Array>} Array of processed document IDs
   */
  async processJobDocuments(jobsDbPath) {
    console.log(chalk.blue(`\nProcessing documents from: ${path.basename(jobsDbPath)}`));
    const processedDocs = [];

    try {
      const jobsData = JSON.parse(fs.readFileSync(jobsDbPath, 'utf8'));
      const date = this.#getDateFromJobsFile(jobsDbPath);
      const source = path.basename(jobsDbPath).startsWith('nswgov-') ? 'nsw-gov' : 'seek';
      
      // Get or create the institution
      const institutionId = await this.#getOrCreateInstitution();

      for (const job of jobsData.jobs || []) {
        if (!job.details?.documents?.length) continue;

        for (const doc of job.details.documents) {
          const documentId = this.#generateDocumentId(job.id, doc.filename);
          
          // Check if document already exists in staging
          const { data: existingDoc } = await this.#supabase
            .from('staging_documents')
            .select('id')
            .eq('source_id', source)
            .eq('external_id', documentId)
            .single();

          if (existingDoc) {
            console.log(chalk.yellow(`  - Document ${doc.filename} already staged, skipping`));
            continue;
          }

          // Stage the document
          try {
            const { data: stagedDoc, error } = await this.#supabase
              .from('staging_documents')
              .insert({
                institution_id: institutionId,
                source_id: source,
                external_id: documentId,
                raw_content: {
                  jobId: job.id,
                  filename: doc.filename,
                  sourceUrl: doc.url,
                  filePath: doc.filePath,
                  jobData: {
                    title: job.title,
                    department: job.department,
                    closeDate: job.closeDate,
                    jobId: job.id
                  }
                },
                metadata: {
                  file_type: path.extname(doc.filename).toLowerCase(),
                  original_filename: doc.filename,
                  source_url: doc.url
                },
                processing_status: 'pending'
              })
              .select()
              .single();

            if (error) {
              console.error(chalk.red(`  - Error staging document ${doc.filename}:`, error.message));
              this.failedDocuments.push({
                file: doc.filename,
                error: error.message,
                type: 'staging'
              });
              continue;
            }

            console.log(chalk.green(`  - Successfully staged document: ${doc.filename}`));
            processedDocs.push(stagedDoc.id);

          } catch (error) {
            console.error(chalk.red(`  - Error processing document ${doc.filename}:`, error.message));
            this.failedDocuments.push({
              file: doc.filename,
              error: error.message,
              type: 'processing'
            });
          }
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error reading jobs data:`, error.message));
      throw error;
    }

    return processedDocs;
  }

  async #upsertDocument(document) {
    try {
      const { data, error } = await this.#supabase
        .from('documents')
        .upsert({
          institution_id: this.#institutionId,
          source_id: 'nswgov',
          external_id: document.id,
          url: document.url,
          text: document.text,
          type: document.type,
          raw_data: document,
          processing_status: 'pending'
        }, {
          onConflict: 'institution_id,source_id,external_id'
        })
        .select();

      if (error) throw error;
      logger.info(`Successfully upserted document: ${document.url}`);
      return data;
    } catch (error) {
      logger.error('Error upserting document:', {
        document: document.url,
        error: {
          message: error.message,
          stack: error.stack,
          details: error
        }
      });
      throw error;
    }
  }

  async #getDocument(documentId) {
    try {
      const { data, error } = await this.#supabase
        .from('documents')
        .select('*')
        .eq('institution_id', this.#institutionId)
        .eq('source_id', 'nswgov')
        .eq('external_id', documentId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error getting document:', {
        documentId,
        error: {
          message: error.message,
          stack: error.stack,
          details: error
        }
      });
      throw error;
    }
  }
}