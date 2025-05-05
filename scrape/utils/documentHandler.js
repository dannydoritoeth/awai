import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import chalk from "chalk";

export class DocumentHandler {
  constructor() {
    // Ensure the files directory exists
    const filesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "database", "jobs", "files");
    if (!fs.existsSync(filesDir)) {
      fs.mkdirSync(filesDir, { recursive: true });
    }
  }

  /**
   * @description Extracts document URLs from the job description
   * @param {string} description - The job description HTML
   * @param {string} source - The source of the job (e.g., 'nswgov', 'seek')
   * @returns {Array<Object>} Array of document objects with url and type
   */
  extractDocumentUrls(description, source) {
    const patterns = {
      nswgov: [
        // NSW Gov specific patterns
        /Role Description:\s*<[^>]*?href="([^"]+)"[^>]*?>(?:[^<]|<(?!\/a>)[^>]*>)*<\/a>/gi,
        /To view the Role Description:\s*<[^>]*?href="([^"]+)"[^>]*?>(?:[^<]|<(?!\/a>)[^>]*>)*<\/a>/gi,
        /read the full Role Description:\s*<[^>]*?href="([^"]+)"[^>]*?>(?:[^<]|<(?!\/a>)[^>]*>)*<\/a>/gi,
        /Statement of Works:\s*<[^>]*?href="([^"]+)"[^>]*?>(?:[^<]|<(?!\/a>)[^>]*>)*<\/a>/gi,
        /<a[^>]*?href="([^"]*?dpie\.nsw\.gov\.au\/\?a=[^"]*)"[^>]*?>(?:[^<]|<(?!\/a>)[^>]*>)*<\/a>/gi,
        /<a[^>]*?href="([^"]*?dpie\.nsw\.gov\.au\/__data\/assets\/word_doc\/[^"]*)"[^>]*?>(?:[^<]|<(?!\/a>)[^>]*>)*<\/a>/gi,
      ],
      seek: [
        // Seek specific patterns
        /Position Description:\s*<[^>]*?href="([^"]+)"[^>]*?>(?:[^<]|<(?!\/a>)[^>]*>)*<\/a>/gi,
        /Job Description:\s*<[^>]*?href="([^"]+)"[^>]*?>(?:[^<]|<(?!\/a>)[^>]*>)*<\/a>/gi,
        /Download PDF:\s*<[^>]*?href="([^"]+)"[^>]*?>(?:[^<]|<(?!\/a>)[^>]*>)*<\/a>/gi,
        // Add more Seek-specific patterns as needed
      ],
      common: [
        // Common patterns for both sources
        /<p>[^<]*(?:view|read)\s+the[^<]*<a[^>]*?href="([^"]+)"[^>]*?>(?:[^<]|<(?!\/a>)[^>]*>)*<\/a>/gi,
        /<p>[^<]*(?:Position|Role|Job)\s*Description[^<]*<a[^>]*?href="([^"]+)"[^>]*?>(?:[^<]|<(?!\/a>)[^>]*>)*<\/a>/gi,
        /(?:Position|Role|Job)\s*Description[^<]*<a[^>]*?href="([^"]+)"[^>]*?>(?:[^<]|<(?!\/a>)[^>]*>)*<\/a>/gi,
      ]
    };
    
    const documents = [];
    const seenUrls = new Set();
    
    // Combine source-specific and common patterns
    const patternsToUse = [...(patterns[source] || []), ...patterns.common];
    
    for (const pattern of patternsToUse) {
      let match;
      while ((match = pattern.exec(description)) !== null) {
        const url = match[1];
        if (seenUrls.has(url)) continue;
        
        seenUrls.add(url);
        
        const textContent = match[0]
          .replace(/<[^>]+>/g, '')
          .replace(/(?:Role|Position|Job)\s*Description:?\s*/gi, '')
          .trim();
        
        // Determine document type based on URL and pattern
        let type = this.#determineDocumentType(url, pattern, source);
        
        documents.push({
          url,
          type,
          title: textContent || 'Document'
        });
      }
    }
    
    return documents;
  }

  /**
   * @description Determines the type of document based on URL and pattern
   * @private
   */
  #determineDocumentType(url, pattern, source) {
    if (pattern.source.toLowerCase().includes('statement')) {
      return 'statement-of-works';
    }
    
    const urlLower = url.toLowerCase();
    if (urlLower.endsWith('.pdf')) {
      return 'pdf-document';
    }
    if (urlLower.includes('word_doc') || urlLower.endsWith('.doc') || urlLower.endsWith('.docx')) {
      return 'word-document';
    }
    
    return source === 'nswgov' ? 'role-description' : 'position-description';
  }

  /**
   * @description Downloads a document from a URL and saves it
   * @param {string} url - The URL of the document
   * @param {string} jobId - The job ID
   * @param {string} docType - The type of document
   * @returns {Promise<string>} The filename of the downloaded document
   */
  async downloadDocument(url, jobId, docType) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to download document: ${response.statusText}`);
      
      const contentType = response.headers.get('content-type');
      let extension = 'doc'; // default extension
      
      // Determine file extension from content type or URL
      if (contentType?.includes('pdf') || url.toLowerCase().endsWith('.pdf')) {
        extension = 'pdf';
      } else if (url.toLowerCase().endsWith('.docx')) {
        extension = 'docx';
      }
      
      const filename = `${jobId}-${docType}.${extension}`;
      const filePath = path.join(
        path.dirname(fileURLToPath(import.meta.url)), 
        "..", 
        "database",
        "jobs",
        "files",
        filename
      );
      
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(filePath, Buffer.from(buffer));
      console.log(chalk.green(`Downloaded document: ${filename}`));
      
      return filename;
    } catch (error) {
      console.log(chalk.yellow(`Error downloading document from ${url}: ${error.message}`));
      return null;
    }
  }
} 