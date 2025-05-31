import fs from 'fs';
import { BaseDocumentProcessor } from './baseDocumentProcessor.js';

export class PDFProcessor extends BaseDocumentProcessor {
  /**
   * Extract text content from a PDF buffer or file path
   */
  async extractContent(pdfContent: Buffer | string): Promise<string | null> {
    try {
      // If pdfContent is a file path, read it into a buffer
      const buffer = typeof pdfContent === 'string' 
        ? await fs.promises.readFile(pdfContent)
        : pdfContent;

      // Import pdf-parse with options to disable test file loading
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(buffer, {
        disableCopyCheck: true,
        disableWorker: true
      });
      
      // Clean up the text
      let text = data.text
        .replace(/\r\n/g, '\n')  // Normalize line endings
        .replace(/\n{3,}/g, '\n\n')  // Reduce multiple newlines
        .replace(/[^\S\n]+/g, ' ')  // Replace multiple spaces with single space
        .replace(/\u0000/g, '')  // Remove null characters
        .replace(/\s+\n/g, '\n')  // Remove spaces before newlines
        .replace(/\n\s+/g, '\n')  // Remove spaces after newlines
        .trim();

      if (!text || text.length < 10) {
        console.error('Extracted PDF content too short or empty');
        return null;
      }

      return text;
    } catch (error) {
      console.error('PDF processing error:', error);
      return null;
    }
  }

  /**
   * Extract structured data from the PDF content
   */
  async extractStructuredData(pdfContent: Buffer | string): Promise<any> {
    const content = await this.extractContent(pdfContent);
    if (!content) return null;

    return this.extractDataWithAI(content);
  }
} 