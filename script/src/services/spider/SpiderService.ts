/**
 * @file SpiderService.ts
 * @description Part of NSW Government Jobs ETL Refactoring
 * 
 * Implementation of the job spider service using Puppeteer.
 * This service maintains the same scraping functionality as the current implementation
 * while improving error handling and performance.
 * 
 * @module services/spider
 * @see RefactorETL.md for the complete refactoring plan
 * 
 * @author AWAI Team
 * @version 1.0.0
 * @since 2024-02-06
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { ISpiderService, JobListing, JobDetails, SpiderConfig, SpiderMetrics, JobDocument } from './types.js';
import { Logger } from '../../utils/logger.js';
import { delay } from '../../utils/helpers.js';
import * as path from 'path';
import * as fs from 'fs';
import { TestDataManager } from '../../utils/TestDataManager.js';

export interface SpiderConfig {
  baseUrl: string;
  maxConcurrency: number;
  retryAttempts: number;
  retryDelay: number;
  userAgent: string;
  pageSize?: number; // Optional page size configuration
}

export interface JobListing {
  id: string;
  title: string;
  agency: string;
  location: string;
  salary: string;
  closingDate: string;
  url: string;
  jobReference: string;
  postedDate: string;
  jobUrl?: string; // Make optional since it's the same as url
  jobId?: string;  // Make optional since it's the same as id
}

export class SpiderService implements ISpiderService {
  private browser: Browser | null = null;
  private metrics: SpiderMetrics;
  private baseUrl = process.env.NSW_JOBS_URL || "https://iworkfor.nsw.gov.au/jobs/all-keywords/all-agencies/all-organisations-entities/all-categories/all-locations/all-worktypes";
  private testDataManager: TestDataManager;
  private currentPage = 1;
  private browserInitialized = false;
  private browserInitPromise: Promise<void> | null = null;

  constructor(
    private config: SpiderConfig,
    private logger: Logger
  ) {
    this.metrics = {
      totalJobs: 0,
      successfulScrapes: 0,
      failedScrapes: 0,
      startTime: new Date(),
      errors: []
    };
    this.testDataManager = new TestDataManager();
  }

  /**
   * Initialize the browser instance if not already initialized
   */
  private async initBrowser(): Promise<void> {
    // If initialization is already in progress, wait for it
    if (this.browserInitPromise) {
      await this.browserInitPromise;
      return;
    }

    // If browser is already initialized, return
    if (this.browserInitialized && this.browser) {
      return;
    }

    // Create a new initialization promise
    this.browserInitPromise = (async () => {
      try {
        this.logger.info('Spider name "nsw gov jobs" launched');
        if (!this.browser) {
          this.browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          });
          this.browserInitialized = true;
          this.logger.info('Browser instance initialized');
        }
      } finally {
        // Clear the promise once initialization is complete
        this.browserInitPromise = null;
      }
    })();

    // Wait for initialization to complete
    await this.browserInitPromise;
  }

  /**
   * Get a new page with default configuration
   */
  private async getPage(): Promise<Page> {
    await this.initBrowser();
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }
    const page = await this.browser.newPage();
    await page.setUserAgent(this.config.userAgent);
    await page.setViewport({ width: 1920, height: 1080 });
    return page;
  }

  /**
   * Scrape job listings from the main jobs page
   */
  async getJobListings(maxRecords?: number): Promise<JobListing[]> {
    try {
      // Try to load test data first if enabled
      const testData = await this.testDataManager.loadJobListings();
      if (testData) {
        return testData;
      }

      const page = await this.getPage();
      const allListings: JobListing[] = [];
      let pageNum = 1;
      let hasNextPage = true;

      try {
        // Navigate to initial URL
        this.logger.info('Loading initial URL:', this.baseUrl);
        await page.goto(this.baseUrl, { waitUntil: 'networkidle0' });
        this.logger.info('Current URL after navigation:', page.url());

        // Log page content length for debugging
        const content = await page.content();
        this.logger.info(`Page content length: ${content.length} characters`);

        // Save raw HTML for debugging if needed
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const htmlPath = path.join(process.cwd(), 'test', 'data', `raw_html_${timestamp}.html`);
        await fs.promises.writeFile(htmlPath, content);
        this.logger.info(`Saved raw HTML to:\n${htmlPath}`);

        // Wait for initial page load
        await delay(5000);

        // Check if we need to change page size
        if (this.config.pageSize) {
          this.logger.info(`Setting page size to ${this.config.pageSize}`);
          // Add logic here to change page size if needed
        } else {
          this.logger.info('Continuing with default page size');
        }

        while (hasNextPage) {
          this.logger.info(`Scraping page ${pageNum}`);

          // Wait for job cards to load
          this.logger.info('Waiting for job cards to load...');
          await page.waitForSelector('.job-card', { timeout: 10000 });
          this.logger.info('Job cards loaded');

          // Extract job listings from current page
          const pageListings = await page.evaluate(() => {
            const cards = document.querySelectorAll('.job-card');
            return Array.from(cards).map(card => {
              const titleElement = card.querySelector('.job-title a') as HTMLAnchorElement | null;
              const agencyElement = card.querySelector('.agency-link');
              const locationElement = card.querySelector('.job-location');
              const salaryElement = card.querySelector('.job-salary');
              const closingElement = card.querySelector('.job-closing-date-value');
              const jobRefElement = card.querySelector('.job-ref');
              const postedElement = card.querySelector('.job-posted-date');
              const id = card.getAttribute('data-jobid') || '';
              const url = titleElement?.href || '';

              return {
                id,
                title: titleElement?.textContent?.trim() || '',
                agency: agencyElement?.textContent?.trim() || '',
                location: locationElement?.textContent?.trim() || '',
                salary: salaryElement?.textContent?.trim() || '',
                closingDate: closingElement?.textContent?.trim() || '',
                url,
                jobReference: jobRefElement?.textContent?.trim().replace('REF:', '').trim() || '',
                postedDate: postedElement?.textContent?.trim() || '',
                jobUrl: url,
                jobId: id
              } as JobListing;
            });
          });

          this.logger.info(`Found ${pageListings.length} listings on page ${pageNum}`);
          allListings.push(...pageListings);

          // Save the current page of listings if test data saving is enabled
          if (process.env.SAVE_TEST_DATA === 'true') {
            await this.testDataManager.saveJobListings(pageListings, pageNum);
          }

          // Check if we've reached the maximum number of records
          if (maxRecords && allListings.length >= maxRecords) {
            this.logger.info(`Reached max records limit of ${maxRecords}`);
            break;
          }

          // Check for next page button
          const nextButton = await page.$('.pagination-next:not([disabled])');
          if (!nextButton) {
            this.logger.info('Next page button not found or disabled');
            hasNextPage = false;
            continue;
          }

          // Check if button is disabled
          const isDisabled = await page.evaluate(
            (button: Element): boolean => button.hasAttribute('disabled'),
            nextButton
          );

          if (isDisabled) {
            this.logger.info('Next page button is disabled');
            hasNextPage = false;
            continue;
          }

          // Click next page and wait for navigation
          this.logger.info('Clicking next page button');
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
            nextButton.click()
          ]);

          // Add delay between pages
          await new Promise(resolve => setTimeout(resolve, 2000));
          pageNum++;
        }

        this.metrics.totalJobs = allListings.length;
        this.metrics.successfulScrapes++;
        this.logger.info(`Found total of ${allListings.length} job listings`);

        return allListings;

      } finally {
        // Close the page but keep the browser instance for reuse
        await page.close();
      }

    } catch (error: any) {
      this.metrics.failedScrapes++;
      this.metrics.errors.push({
        timestamp: new Date(),
        error: error?.message || 'Unknown error',
        url: this.baseUrl
      });
      this.logger.error('Error scraping job listings:', error);
      throw error;
    }
  }

  private async saveJobListingsData(listings: JobListing[]): Promise<void> {
    try {
      await this.testDataManager.saveJobListings(listings);
      this.logger.info(`Saved ${listings.length} job listings to test data`);
    } catch (error) {
      this.logger.error('Error saving job listings data:', error);
    }
  }

  private async saveTestData(jobListing: JobListing, page: Page, jobDetails: JobDetails) {
    if (process.env.SAVE_TEST_DATA !== 'true') return;

    try {
      const content = await page.content();
      await this.testDataManager.saveJobDetails(jobListing, content, jobDetails);
      this.logger.info(`Saved test data for job ${jobListing.jobId}`);
    } catch (error) {
      this.logger.error('Error saving job test data:', error);
    }
  }

  /**
   * Save raw HTML from the page for testing/debugging
   */
  private async saveRawHtml(html: string): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const testDataDir = path.join(process.cwd(), 'test', 'data');
      
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }

      const filePath = path.join(testDataDir, `raw_html_${timestamp}.html`);
      fs.writeFileSync(filePath, html, 'utf8');
      this.logger.info('Saved raw HTML to:', filePath);
    } catch (error) {
      this.logger.error('Error saving raw HTML:', error);
    }
  }

  /**
   * Scrape detailed job information from a specific job listing
   */
  async getJobDetails(jobListing: JobListing): Promise<JobDetails> {
    this.logger.info(`Scraping details for job: ${jobListing.title}`);
    
    // Use jobUrl if available, otherwise fall back to url
    const targetUrl = jobListing.jobUrl || jobListing.url;
    if (!targetUrl) {
      throw new Error(`No URL available for job ${jobListing.title} (ID: ${jobListing.id})`);
    }
    this.logger.info(`Job URL: ${targetUrl}`);

    try {
      // Try to load from test scenario first
      const testDetails = await this.testDataManager.loadJobDetails(jobListing.jobId);
      if (testDetails) {
        this.logger.info(`Loaded job details from test scenario for job ${jobListing.jobId}`);
        this.metrics.successfulScrapes++;
        return testDetails;
      }

      // If not in test scenario mode, proceed with normal scraping
      const page = await this.getPage();
      await page.goto(targetUrl, { waitUntil: 'networkidle0' });

      const details = await page.evaluate((listing) => {
        const getTextContent = (selector: string): string => {
          const elements = document.querySelectorAll(selector);
          return Array.from(elements)
            .map(el => el.textContent?.trim())
            .filter(Boolean)
            .join('\n\n');
        };

        const getTableValue = (label: string): string => {
          const row = Array.from(document.querySelectorAll('table.job-summary tr')).find(row => {
            const labelCell = row.querySelector('td:first-child');
            return labelCell?.textContent?.trim().toLowerCase().includes(label.toLowerCase());
          });
          return row?.querySelector('td:last-child')?.textContent?.trim() || '';
        };

        // Get all document links
        const documents: JobDocument[] = [];
        
        // Helper function to check if text indicates a relevant document
        const isRelevantDocument = (text: string): boolean => {
          // Primary document keywords - these are definitely role-related documents
          const primaryKeywords = [
            'role description',
            'position description',
            'job description',
            'duty statement',
            'statement of duties'
          ];

          // Secondary document keywords - only include if they appear with role-related terms
          const secondaryKeywords = [
            'information pack',
            'candidate pack',
            'application pack'
          ];

          const textLower = text.toLowerCase();
          
          // Check for primary keywords first
          if (primaryKeywords.some(keyword => textLower.includes(keyword))) {
            return true;
          }

          // For secondary keywords, check if they also contain role-related terms
          if (secondaryKeywords.some(keyword => textLower.includes(keyword))) {
            const hasRoleContext = [
              'role',
              'position',
              'job',
              'candidate',
              'firefighter',  // Include specific role terms if they appear in the context
              'officer'
            ].some(term => textLower.includes(term));
            return hasRoleContext;
          }

          return false;
        };

        // Helper function to determine document type
        const getDocumentType = (url: string): string => {
          if (url.toLowerCase().endsWith('.pdf')) return 'pdf';
          if (url.toLowerCase().endsWith('.doc')) return 'doc';
          if (url.toLowerCase().endsWith('.docx')) return 'docx';
          if (url.toLowerCase().includes('transferrichtextfile.ashx')) return 'doc';
          return 'unknown';
        };

        // Find all links that might be documents
        document.querySelectorAll('a').forEach(link => {
          const url = link.getAttribute('href');
          const text = link.textContent?.trim() || '';
          
          if (url && isRelevantDocument(text)) {
            const fullUrl = url.startsWith('http') ? url : new URL(url, window.location.href).href;
            documents.push({
              url: fullUrl,
              title: text || undefined,
              type: getDocumentType(fullUrl)
            });
          }
        });

        // Get job details from the summary table
        const agency = getTableValue('organisation');
        const jobType = getTableValue('work type');
        const location = getTableValue('job location');
        const jobReference = getTableValue('reference number');

        // Get main job description content
        const description = document.querySelector('.job-detail-des')?.textContent?.trim() || '';

        // Parse the description to extract different sections
        const sections = description.split(/\n{2,}/).filter(Boolean);
        
        const responsibilities: string[] = [];
        const requirements: string[] = [];
        const notes: string[] = [];
        let aboutUs = '';

        sections.forEach(section => {
          const sectionLower = section.toLowerCase();
          if (sectionLower.includes('key selection criteria') || sectionLower.includes('essential')) {
            requirements.push(...section.split(/\d+\./).filter(Boolean).map(s => s.trim()));
          } else if (sectionLower.includes('summary role') || sectionLower.includes('role description') || sectionLower.includes('responsibilities')) {
            responsibilities.push(section.trim());
          } else if (sectionLower.includes('about us') || sectionLower.includes('about karitane') || sectionLower.includes('about the organisation')) {
            aboutUs = section.trim();
          } else if (sectionLower.includes('note') || sectionLower.includes('additional information')) {
            notes.push(section.trim());
          }
        });

        // Get contact details
        const contactDetails = {
          name: '',
          phone: '',
          email: ''
        };

        // Look for contact information in the description
        const contactSection = description.match(/(?:enquiries|contact|email|phone|tel)[^]*?(?=\n\n|\n?$)/i)?.[0] || '';
        if (contactSection) {
          const emailMatch = contactSection.match(/[\w.-]+@[\w.-]+\.\w+/);
          const phoneMatch = contactSection.match(/(?:phone|tel|mob)[.: ]*([0-9 ]+)/i);
          const nameMatch = contactSection.match(/(?:contact|attention)[.: ]*([\w\s]+)/i);

          if (emailMatch) contactDetails.email = emailMatch[0];
          if (phoneMatch) contactDetails.phone = phoneMatch[1];
          if (nameMatch) contactDetails.name = nameMatch[1].trim();
        }

        return {
          ...listing,
          agency,
          jobType,
          location,
          jobReference,
          description,
          responsibilities,
          requirements,
          notes,
          aboutUs,
          contactDetails,
          documents
        };
      }, jobListing);

      // Save test data if enabled
      await this.saveTestData(jobListing, page, details);

      // Log found documents
      if (details.documents?.length > 0) {
        this.logger.info(`Found ${details.documents.length} attached documents:`, 
          details.documents.map(d => ({ url: d.url, title: d.title, type: d.type }))
        );
      } else {
        this.logger.info('No attached documents found');
      }

      // Log content summary
      this.logger.info('Job content summary:', {
        title: details.title,
        descriptionLength: details.description.length,
        responsibilitiesCount: details.responsibilities.length,
        requirementsCount: details.requirements.length,
        notesCount: details.notes.length,
        aboutUsLength: details.aboutUs.length,
        documentsCount: details.documents.length
      });

      this.metrics.successfulScrapes++;
      await page.close();
      return details;

    } catch (error) {
      this.metrics.failedScrapes++;
      this.metrics.errors.push({
        url: targetUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });
      this.logger.error(`Error scraping job details for ${jobListing.title}:`, error);
      throw error;
    }
  }

  /**
   * Get current spider metrics
   */
  getMetrics(): SpiderMetrics {
    return {
      ...this.metrics,
      endTime: new Date()
    };
  }

  /**
   * Cleanup browser resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.browserInitialized = false;
        this.browserInitPromise = null;
        this.logger.info('Browser instance closed');
      }
    } catch (error) {
      this.logger.error('Error closing browser:', error);
    }
  }
} 