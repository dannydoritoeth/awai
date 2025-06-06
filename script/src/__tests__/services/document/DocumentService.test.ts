import { DocumentService } from '../../../services/document/DocumentService.js';
import { Logger } from '../../../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jest } from '@jest/globals';
import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock axios
jest.mock('axios');

// Type for mocked axios response
type MockedAxiosResponse = {
  data: Buffer;
  status: number;
  headers: Record<string, string>;
};

describe('DocumentService', () => {
  let documentService: DocumentService;
  let logger: Logger;
  let mockedGet: jest.Mock;

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as unknown as Logger;
    documentService = new DocumentService(logger);

    // Reset all mocks and capture axios.get mock
    jest.resetAllMocks();
    mockedGet = jest.fn();
    (axios.get as jest.Mock) = mockedGet;
  });

  describe('getDocumentType', () => {
    const testCases = [
      {
        description: 'detects PDF from URL extension',
        url: 'https://example.com/document.pdf',
        contentType: undefined,
        expected: 'pdf'
      },
      {
        description: 'detects DOCX from URL extension',
        url: 'https://example.com/document.docx',
        contentType: undefined,
        expected: 'docx'
      },
      {
        description: 'detects DOC from URL extension',
        url: 'https://example.com/document.doc',
        contentType: undefined,
        expected: 'docx'
      },
      {
        description: 'detects PDF from content type',
        url: 'https://example.com/document',
        contentType: 'application/pdf',
        expected: 'pdf'
      },
      {
        description: 'detects DOCX from content type',
        url: 'https://example.com/document',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        expected: 'docx'
      },
      {
        description: 'returns unknown for unrecognized extension',
        url: 'https://example.com/document.xyz',
        contentType: undefined,
        expected: 'unknown'
      },
      {
        description: 'returns unknown for unrecognized content type',
        url: 'https://example.com/document',
        contentType: 'application/octet-stream',
        expected: 'unknown'
      }
    ];

    testCases.forEach(({ description, url, contentType, expected }) => {
      it(description, () => {
        // @ts-ignore - accessing private method for testing
        const result = documentService.getDocumentType(url, contentType);
        expect(result).toBe(expected);
      });
    });
  });

  describe('document parsing', () => {
    const testDocsPath = path.join(__dirname, '..', '..', '..', '..', 'test', 'data', 'docs');

    it('parses PDF documents', async () => {
      const pdfPath = path.join(testDocsPath, 'test.pdf');
      const pdfBuffer = fs.readFileSync(pdfPath);

      // @ts-ignore - accessing private method for testing
      const result = await documentService.parsePDF(pdfBuffer);

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('structure');
      expect(result.structure).toHaveProperty('pages');
      expect(Array.isArray(result.structure.pages)).toBe(true);
      
      // Verify page structure
      result.structure.pages.forEach(page => {
        expect(page).toHaveProperty('texts');
        expect(page).toHaveProperty('number');
        expect(Array.isArray(page.texts)).toBe(true);
        
        page.texts.forEach(text => {
          expect(text).toHaveProperty('text');
          expect(text).toHaveProperty('x');
          expect(text).toHaveProperty('y');
          expect(text).toHaveProperty('fontSize');
        });
      });
    });

    it('parses DOCX documents', async () => {
      const docxPath = path.join(testDocsPath, 'test.docx');
      const docxBuffer = fs.readFileSync(docxPath);

      // @ts-ignore - accessing private method for testing
      const result = await documentService.parseDOCX(docxBuffer);

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('structure');
      expect(result.structure).toHaveProperty('paragraphs');
      expect(Array.isArray(result.structure.paragraphs)).toBe(true);

      // Verify paragraph structure
      result.structure.paragraphs.forEach(paragraph => {
        expect(paragraph).toHaveProperty('index');
        expect(paragraph).toHaveProperty('text');
        expect(typeof paragraph.text).toBe('string');
        expect(paragraph.text.length).toBeGreaterThan(0);
      });
    });

    it('processes multiple documents in parallel', async () => {
      const documents = [
        {
          url: 'file://' + path.join(testDocsPath, 'test.pdf').replace(/\\/g, '/'),
          type: 'pdf',
          title: 'Test PDF'
        },
        {
          url: 'file://' + path.join(testDocsPath, 'test.docx').replace(/\\/g, '/'),
          type: 'docx',
          title: 'Test DOCX'
        }
      ];

      const results = await documentService.processDocuments(documents);

      expect(results).toHaveLength(2);
      
      // Verify PDF result
      const pdfDoc = results.find(doc => doc.type === 'pdf');
      expect(pdfDoc).toBeDefined();
      expect(pdfDoc?.parsedContent).toBeDefined();
      expect(pdfDoc?.parsedContent?.type).toBe('pdf');
      expect(pdfDoc?.parsedContent?.text).toBeDefined();
      expect(pdfDoc?.parsedContent?.structure).toBeDefined();

      // Verify DOCX result
      const docxDoc = results.find(doc => doc.type === 'docx');
      expect(docxDoc).toBeDefined();
      expect(docxDoc?.parsedContent).toBeDefined();
      expect(docxDoc?.parsedContent?.type).toBe('docx');
      expect(docxDoc?.parsedContent?.text).toBeDefined();
      expect(docxDoc?.parsedContent?.structure).toBeDefined();
    });

    it('handles errors gracefully when processing invalid documents', async () => {
      // Mock axios to return an error response
      jest.spyOn(axios, 'get').mockImplementation(() => Promise.reject(new Error('Network error')));

      const invalidDocuments = [
        {
          url: 'https://invalid-url.com/test.pdf',
          type: 'pdf',
          title: 'Invalid PDF'
        }
      ];

      const results = await documentService.processDocuments(invalidDocuments);
      expect(results).toHaveLength(0);
      expect(logger.error).toHaveBeenCalled();
    });

    it('rejects invalid content types', async () => {
      // Mock axios to return HTML instead of a PDF
      const mockResponse = {
        data: Buffer.from('<html><body>Not a PDF</body></html>'),
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html'
        },
        config: {
          headers: {} // Required by InternalAxiosRequestConfig
        } as InternalAxiosRequestConfig
      };

      jest.spyOn(axios, 'get').mockImplementation(() => Promise.resolve(mockResponse));

      const documents = [
        {
          url: 'https://example.com/fake.pdf',
          type: 'pdf',
          title: 'Fake PDF'
        }
      ];

      const results = await documentService.processDocuments(documents);
      expect(results).toHaveLength(0);
      expect(logger.error).toHaveBeenCalled();
    });

    it('rejects documents with invalid structure', async () => {
      // Mock axios to return invalid PDF data
      const mockResponse = {
        data: Buffer.from('Not a real PDF file'),
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'application/pdf'
        },
        config: {
          headers: {} // Required by InternalAxiosRequestConfig
        } as InternalAxiosRequestConfig
      };

      jest.spyOn(axios, 'get').mockImplementation(() => Promise.resolve(mockResponse));

      const documents = [
        {
          url: 'https://example.com/invalid.pdf',
          type: 'pdf',
          title: 'Invalid PDF'
        }
      ];

      const results = await documentService.processDocuments(documents);
      expect(results).toHaveLength(0);
      expect(logger.error).toHaveBeenCalled();
    });
  });
}); 