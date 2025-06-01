import { JSDOM } from 'jsdom';
import { BaseDocumentProcessor } from './baseDocumentProcessor.js';

export class HTMLProcessor extends BaseDocumentProcessor {
  /**
   * Extracts text content from HTML
   * @param html HTML content as string
   * @returns Cleaned text content
   */
  async extractContent(html: string): Promise<string | null> {
    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // Remove script and style elements
      document.querySelectorAll('script, style').forEach(el => el.remove());

      // Extract text from specific job description elements
      const descriptionElement = document.querySelector('#descriptionExt-value, .job-description, .role-description');
      if (descriptionElement) {
        return this.cleanText(descriptionElement.textContent || '');
      }

      // Fallback to body content if no specific elements found
      return this.cleanText(document.body.textContent || '');
    } catch (error) {
      console.error('Error processing HTML:', error);
      return null;
    }
  }

  /**
   * Clean and normalize text content
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
      .trim();
  }

  /**
   * Extract structured data from the HTML content
   */
  async extractStructuredData(html: string): Promise<any> {
    const content = await this.extractContent(html);
    if (!content) return null;

    return this.extractDataWithAI(content);
  }
} 