import axios from 'axios';
import { Logger } from '../../utils/logger.js';
import { JobDocument, PDFStructure, DOCXStructure, TextStructure } from '../../models/job.js';
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
          // Extract and clean text from each page
          const pages = pdfData.Pages.map((page, pageIndex) => {
            // Sort texts by Y position first, then X position for proper reading order
            const sortedTexts = page.Texts.sort((a, b) => {
              const yDiff = a.y - b.y;
              return yDiff !== 0 ? yDiff : a.x - b.x;
            });

            // Process texts with proper spacing and line breaks
            const processedTexts = sortedTexts.map((text, index) => {
              const decodedText = decodeURIComponent(text.R[0].T).trim();
              const prevText = index > 0 ? sortedTexts[index - 1] : null;
              
              // Add spacing based on position differences
              let prefix = '';
              if (prevText) {
                const yDiff = text.y - prevText.y;
                const xDiff = text.x - prevText.x;
                
                if (yDiff > 1) {
                  // New paragraph
                  prefix = '\n\n';
                } else if (yDiff > 0.1) {
                  // New line
                  prefix = '\n';
                } else if (xDiff > 1 && !decodedText.startsWith(' ')) {
                  // Same line but significant x difference
                  prefix = ' ';
                }
              }

              return {
                text: decodedText,
                x: text.x,
                y: text.y,
                fontSize: text.R[0].TS[2],
                prefix
              };
            });

            // Combine texts with proper spacing
            const pageText = processedTexts.map(t => t.prefix + t.text).join('');

            return {
              texts: processedTexts.map(({ text, x, y, fontSize }) => ({
                text,
                x,
                y,
                fontSize
              })),
              number: pageIndex + 1,
              text: pageText.trim()
            };
          });

          // Combine all page texts with proper spacing
          const text = pages
            .map(p => p.text)
            .join('\n\n')
            .replace(/\n{3,}/g, '\n\n')  // Replace multiple newlines with double newline
            .replace(/\s+/g, ' ')         // Replace multiple spaces with single space
            .trim();

          resolve({
            text,
            structure: { pages }
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
      // Use mammoth options to transform the document
      const options = {
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p => p:fresh",
          "r => span"
        ],
        transformDocument: (element: { type: string; }) => {
          // Remove comments
          if (element.type === "comment") {
            return [];
          }
          // Keep the element unchanged
          return element;
        }
      };

      // Extract both raw text and HTML structure
      const [rawResult, htmlResult] = await Promise.all([
        mammoth.extractRawText({ buffer: docxBuffer }),
        mammoth.convertToHtml({ buffer: docxBuffer }, options)
      ]);

      // Get clean text without excessive whitespace
      const text = rawResult.value
        .replace(/\n{3,}/g, '\n\n')  // Replace multiple newlines with double newline
        .replace(/\s+/g, ' ')        // Replace multiple spaces with single space
        .trim();                     // Trim whitespace from ends

      // Create a structured representation
      const paragraphs = text.split('\n\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);  // Remove empty paragraphs

      const structure: DOCXStructure = {
        paragraphs: paragraphs.map((p, i) => ({
          index: i,
          text: p
        }))
      };

      // Log any warnings from both conversions
      const warnings = [...rawResult.messages, ...htmlResult.messages];
      if (warnings.length > 0) {
        this.logger.warn('DOCX parsing warnings:', warnings);
      }

      return {
        text,
        structure
      };
    } catch (error) {
      this.logger.error('Error parsing DOCX:', error);
      throw {
        parserError: error,
        message: 'Error parsing DOCX content'
      };
    }
  }

  /**
   * Extract filename from Content-Disposition header
   */
  private getFilenameFromHeader(contentDisposition?: string): string | undefined {
    if (!contentDisposition) return undefined;

    // Try filename*=UTF-8'' format first (RFC 5987)
    const utf8FilenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8FilenameMatch) {
      try {
        return decodeURIComponent(utf8FilenameMatch[1]);
      } catch (e) {
        this.logger.warn('Failed to decode UTF-8 filename', { error: e });
      }
    }

    // Try regular filename format
    const filenameMatch = contentDisposition.match(/filename=["']?([^"';]+)/i);
    if (filenameMatch) {
      return filenameMatch[1];
    }

    return undefined;
  }

  /**
   * Determines document type from URL or content
   */
  private async determineDocumentType(buffer: Buffer, url: string, contentType?: string, filename?: string): Promise<string> {
    // First check the actual filename if available (from Content-Disposition)
    if (filename) {
      const filenameLower = filename.toLowerCase();
      if (filenameLower.endsWith('.pdf')) return 'pdf';
      if (filenameLower.endsWith('.docx') || filenameLower.endsWith('.doc')) return 'docx';
    }

    // Then check the URL extension
    const urlLower = url.toLowerCase();
    if (urlLower.endsWith('.pdf')) return 'pdf';
    if (urlLower.endsWith('.docx') || urlLower.endsWith('.doc')) return 'docx';

    // Then check content type if available
    if (contentType) {
      const contentTypeLower = contentType.toLowerCase();
      if (contentTypeLower.includes('pdf')) return 'pdf';
      if (contentTypeLower.includes('word') || contentTypeLower.includes('docx')) return 'docx';
    }

    // If type is still unknown, try to parse as both types
    try {
      // Try PDF first
      try {
        await this.parsePDF(buffer);
        return 'pdf';
      } catch (pdfError) {
        this.logger.debug('Failed to parse as PDF, trying DOCX', { error: pdfError });
      }

      // Try DOCX next
      try {
        await this.parseDOCX(buffer);
        return 'docx';
      } catch (docxError) {
        this.logger.debug('Failed to parse as DOCX', { error: docxError });
      }

      // If both fail, log and return unknown
      this.logger.warn('Could not determine document type by parsing', {
        url,
        contentType,
        filename,
        bufferLength: buffer.length
      });
      return 'unknown';
    } catch (error) {
      this.logger.error('Error while determining document type', {
        error,
        url,
        contentType,
        filename
      });
      return 'unknown';
    }
  }

  /**
   * Processes multiple documents in parallel
   */
  async processDocuments(documents: Array<{ url: string; title?: string; type?: string; }>): Promise<JobDocument[]> {
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

      const successfulDocs = results.filter((doc): doc is JobDocument => doc !== null);
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
  async downloadAndProcessDocument(url: string, title?: string, type?: string): Promise<JobDocument> {
    try {
      // Only accept valid types, otherwise treat as undefined
      const validType = type && ['pdf', 'docx'].includes(type.toLowerCase()) ? type.toLowerCase() : undefined;
      
      this.logger.info(`Starting document download:`, {
        url,
        title,
        specifiedType: type,
        validType
      });
      
      let buffer: Buffer;
      let contentType: string | undefined;
      let filename: string | undefined;

      // Handle file:// URLs for testing
      if (url.startsWith('file://')) {
        const filePath = url.replace('file://', '');
        buffer = fs.readFileSync(filePath);
        contentType = validType;
        filename = filePath.split('/').pop();
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
        filename = this.getFilenameFromHeader(response.headers['content-disposition']);

        this.logger.info(`Document downloaded successfully:`, {
          url,
          contentType,
          contentLength: response.headers['content-length'],
          contentDisposition: response.headers['content-disposition'],
          filename,
          status: response.status
        });
      }

      // Determine document type
      const documentType = validType || await this.determineDocumentType(buffer, url, contentType, filename);
      this.logger.info(`Determined document type:`, {
        url,
        documentType,
        fromType: !!validType,
        fromFilename: filename ? filename.toLowerCase().endsWith(`.${documentType}`) : false,
        fromUrl: url.toLowerCase().endsWith(`.${documentType}`),
        fromContentType: contentType ? contentType.toLowerCase().includes(documentType) : false,
        wasGuessed: !validType && 
          !filename?.toLowerCase().endsWith(`.${documentType}`) && 
          !url.toLowerCase().endsWith(`.${documentType}`) && 
          (!contentType || !contentType.toLowerCase().includes(documentType))
      });

      // Validate document type
      if (documentType === 'unknown') {
        throw new Error('Could not determine document type');
      }
      
      let parsedContent = undefined;
      
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
        parsedContent,
        lastModified: new Date(),
      };

      this.logger.info(`Document processing completed:`, {
        url,
        documentType,
        hasParsedContent: !!parsedContent,
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