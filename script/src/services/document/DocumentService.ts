import axios from 'axios';
import { Logger } from '../../utils/logger.js';
import { Document, PDFStructure, DOCXStructure, TextStructure } from '../../models/job.js';
import PDFParser from 'pdf2json';
import mammoth from 'mammoth';
import fs from 'fs';

export class DocumentService {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Converts PDF buffer to text using pdf2json
   */
  private async parsePDF(pdfBuffer: Buffer): Promise<{text: string; structure: PDFStructure}> {
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser();

      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        try {
          // Get raw text content
          const text = pdfParser.getRawTextContent();
          
          // Clean up the JSON data to remove unnecessary properties
          const structure: PDFStructure = {
            pages: pdfData.Pages.map((page, index) => ({
              texts: page.Texts.map(text => ({
                text: decodeURIComponent(text.R[0].T),
                x: text.x,
                y: text.y,
                fontSize: text.R[0].TS[2]
              })),
              number: index + 1
            }))
          };

          resolve({
            text,
            structure
          });
        } catch (error) {
          reject({
            parserError: error,
            message: 'Error parsing PDF content'
          });
        }
      });

      pdfParser.on('pdfParser_dataError', (errData) => {
        reject({
          parserError: errData,
          message: 'Error in PDF parser'
        });
      });

      try {
        pdfParser.parseBuffer(pdfBuffer);
      } catch (error) {
        reject({
          parserError: error,
          message: 'Error initializing PDF parser'
        });
      }
    });
  }

  /**
   * Converts DOCX buffer to text using mammoth
   */
  private async parseDOCX(docxBuffer: Buffer): Promise<{text: string; structure: DOCXStructure}> {
    try {
      const result = await mammoth.extractRawText({ buffer: docxBuffer });
      const text = result.value;

      // Create a simple structure representation
      const paragraphs = text.split('\n\n').filter(p => p.trim());
      const structure: DOCXStructure = {
        paragraphs: paragraphs.map((p, i) => ({
          index: i,
          text: p.trim()
        }))
      };

      return {
        text,
        structure
      };
    } catch (error) {
      throw {
        parserError: error,
        message: 'Error parsing DOCX content'
      };
    }
  }

  /**
   * Determines document type from URL or content
   */
  private getDocumentType(url: string, contentType?: string): string {
    // First check the URL extension
    const urlLower = url.toLowerCase();
    if (urlLower.endsWith('.pdf')) return 'pdf';
    if (urlLower.endsWith('.docx') || urlLower.endsWith('.doc')) return 'docx';

    // Then check content type if available
    if (contentType) {
      const contentTypeLower = contentType.toLowerCase();
      if (contentTypeLower.includes('pdf')) return 'pdf';
      if (contentTypeLower.includes('word') || contentTypeLower.includes('docx')) return 'docx';
    }

    return 'unknown';
  }

  /**
   * Processes multiple documents in parallel
   */
  async processDocuments(documents: Array<{ url: string; title?: string; type?: string; }>): Promise<Document[]> {
    try {
      this.logger.info(`Starting to process ${documents.length} documents`);
      
      const downloadPromises = documents.map(doc => {
        this.logger.info(`Queuing document for processing:`, {
          url: doc.url,
          title: doc.title,
          specifiedType: doc.type
        });
        return this.downloadAndProcessDocument(doc.url, doc.title, doc.type);
      });

      const results = await Promise.all(
        downloadPromises.map(p => p.catch(error => {
          this.logger.error('Document processing failed:', {
            error: error,
            code: (error as any)?.code,
            message: (error as Error)?.message,
            response: (error as any)?.response?.status,
            contentType: (error as any)?.response?.headers?.['content-type']
          });
          return null;
        }))
      );

      const successfulDocs = results.filter((doc): doc is Document => doc !== null);
      this.logger.info(`Document processing completed:`, {
        total: documents.length,
        successful: successfulDocs.length,
        failed: documents.length - successfulDocs.length
      });

      return successfulDocs;
    } catch (error) {
      this.logger.error('Error in batch document processing:', {
        error: error,
        code: (error as any)?.code,
        message: (error as Error)?.message,
        stack: (error as Error)?.stack
      });
      throw error;
    }
  }

  /**
   * Downloads and processes a document from a URL
   */
  async downloadAndProcessDocument(url: string, title?: string, type?: string): Promise<Document> {
    try {
      this.logger.info(`Starting document download:`, {
        url,
        title,
        specifiedType: type
      });
      
      let buffer: Buffer;
      let contentType: string | undefined;

      // Handle file:// URLs for testing
      if (url.startsWith('file://')) {
        const filePath = url.replace('file://', '');
        buffer = fs.readFileSync(filePath);
        contentType = type || this.getDocumentType(url);
      } else {
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 30000,
          maxContentLength: 10 * 1024 * 1024,
          headers: {
            'Accept': 'application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, */*'
          },
          validateStatus: (status) => status === 200 // Only accept 200 OK
        });

        buffer = Buffer.from(response.data);
        contentType = response.headers['content-type'];

        // Validate content type
        if (contentType && !contentType.includes('pdf') && !contentType.includes('word') && !contentType.includes('docx')) {
          throw new Error(`Invalid content type: ${contentType}`);
        }

        this.logger.info(`Document downloaded successfully:`, {
          url,
          contentType: contentType,
          contentLength: response.headers['content-length'],
          status: response.status
        });
      }

      let content = buffer.toString('base64');
      let parsedContent = undefined;

      // Determine document type
      const documentType = type || this.getDocumentType(url, contentType);
      this.logger.info(`Determined document type:`, {
        url,
        documentType,
        fromType: !!type,
        fromUrl: url.toLowerCase().endsWith(`.${documentType}`),
        fromContentType: contentType
      });

      // Validate document type
      if (documentType === 'unknown') {
        throw new Error('Unknown document type');
      }
      
      // Parse based on document type
      try {
        switch (documentType) {
          case 'pdf': {
            this.logger.info(`Starting PDF parsing:`, { url });
            const { text, structure } = await this.parsePDF(buffer);
            
            // Basic validation of PDF structure
            if (!structure.pages || structure.pages.length === 0) {
              throw new Error('Invalid PDF structure: no pages found');
            }

            parsedContent = {
              text,
              structure,
              type: 'pdf' as const
            };
            this.logger.info(`PDF parsing completed:`, {
              url,
              textLength: text.length,
              pages: structure.pages.length
            });
            break;
          }

          case 'docx': {
            this.logger.info(`Starting DOCX parsing:`, { url });
            const { text, structure } = await this.parseDOCX(buffer);

            // Basic validation of DOCX structure
            if (!structure.paragraphs || structure.paragraphs.length === 0) {
              throw new Error('Invalid DOCX structure: no paragraphs found');
            }

            parsedContent = {
              text,
              structure,
              type: 'docx' as const
            };
            this.logger.info(`DOCX parsing completed:`, {
              url,
              textLength: text.length,
              paragraphs: structure.paragraphs.length
            });
            break;
          }

          default: {
            throw new Error(`Unsupported document type: ${documentType}`);
          }
        }
      } catch (error) {
        this.logger.error(`Error parsing document:`, {
          url,
          documentType,
          error: error,
          message: (error as Error)?.message,
          stack: (error as Error)?.stack
        });
        throw error; // Re-throw to be caught by the outer try-catch
      }
      
      const result = {
        url,
        title: title || '',
        type: documentType,
        content,
        parsedContent,
        lastModified: new Date(),
      };

      this.logger.info(`Document processing completed:`, {
        url,
        documentType,
        hasContent: !!content,
        hasParsedContent: !!parsedContent,
        contentLength: content.length,
        parsedTextLength: parsedContent?.text.length
      });

      return result;
    } catch (error) {
      this.logger.error(`Error processing document:`, {
        url,
        error: error,
        code: (error as any)?.code,
        message: (error as Error)?.message,
        response: (error as any)?.response?.status,
        contentType: (error as any)?.response?.headers?.['content-type']
      });
      throw error;
    }
  }
} 