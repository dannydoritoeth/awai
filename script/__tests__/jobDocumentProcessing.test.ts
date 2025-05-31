import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HTMLProcessor } from '../utils/htmlProcessor.js';
import { PDFProcessor } from '../utils/pdfProcessor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Job Document Processing', () => {
  let htmlProcessor: HTMLProcessor;
  let pdfProcessor: PDFProcessor;
  
  beforeAll(() => {
    htmlProcessor = new HTMLProcessor();
    pdfProcessor = new PDFProcessor();
  });

  describe('HTML Job Posting Processing', () => {
    const htmlPath = path.join(__dirname, 'resources', 'Digital Solutions Analyst.html');
    let htmlContent: string;

    beforeAll(() => {
      htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    });

    test('should extract text content from HTML', async () => {
      const content = await htmlProcessor.extractContent(htmlContent);
      expect(content).toBeTruthy();
      expect(content).toContain('Digital Solutions Analyst');
      expect(content).toContain('Powerhouse Museum');
    });

    test('should extract structured data from HTML', async () => {
      const data = await htmlProcessor.extractStructuredData(htmlContent);
      expect(data).toBeTruthy();
      expect(data).toHaveProperty('title', 'Digital Solutions Analyst');
      expect(data).toHaveProperty('gradeBand', 'Clerk Grade 7-8');
      expect(data).toHaveProperty('agency', 'Powerhouse Museum');
      expect(data.skills).toBeInstanceOf(Array);
      expect(data.skills.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('PDF Role Description Processing', () => {
    const pdfPath = path.join(__dirname, 'resources', 'RD_Digital-Solutions-Analyst.pdf');
    let pdfBuffer: Buffer;

    beforeAll(() => {
      pdfBuffer = fs.readFileSync(pdfPath);
    });

    test('should extract text content from PDF', async () => {
      const content = await pdfProcessor.extractContent(pdfBuffer);
      expect(content).toBeTruthy();
      expect(content).toContain('Digital Solutions Analyst');
      expect(content).toContain('Powerhouse Museum');
    });

    test('should extract structured data from PDF', async () => {
      const data = await pdfProcessor.extractStructuredData(pdfBuffer);
      expect(data).toBeTruthy();
      expect(data).toHaveProperty('title', 'Digital Solutions Analyst');
      expect(data).toHaveProperty('gradeBand', 'Clerk Grade 7-8');
      expect(data).toHaveProperty('agency', 'Powerhouse Museum');
      expect(data.skills).toBeInstanceOf(Array);
      expect(data.skills.length).toBeGreaterThan(0);
    }, 30000);

    test('should extract consistent core data between HTML and PDF', async () => {
      const htmlData = await htmlProcessor.extractStructuredData(fs.readFileSync(path.join(__dirname, 'resources', 'Digital Solutions Analyst.html'), 'utf-8'));
      const pdfData = await pdfProcessor.extractStructuredData(pdfBuffer);

      // Compare only core fields that should be consistent
      expect(htmlData.title).toBe(pdfData.title);
      expect(htmlData.gradeBand).toBe(pdfData.gradeBand);
      expect(htmlData.agency).toBe(pdfData.agency);
    }, 60000);
  });
}); 