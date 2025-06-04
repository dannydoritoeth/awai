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
import path from 'path';
import fs from 'fs';
import { TestDataManager } from '../../utils/TestDataManager.js';

export class SpiderService implements ISpiderService {
  private browser: Browser | null = null;
  private metrics: SpiderMetrics;
  private baseUrl = process.env.NSW_JOBS_URL || "https://iworkfor.nsw.gov.au/jobs/all-keywords/all-agencies/all-organisations-entities/all-categories/all-locations/all-worktypes";
  private testDataManager: TestDataManager;

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
   * Initialize the browser instance
   */
  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.logger.info('Spider name "nsw gov jobs" launched');
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      this.logger.info('Browser instance initialized');
    }
  }

  /**
   * Get a new page with default configuration
   */
  private async getPage(): Promise<Page> {
    await this.initBrowser();
    const page = await this.browser!.newPage();
    await page.setUserAgent(this.config.userAgent);
    await page.setViewport({ width: 1920, height: 1080 });
    return page;
  }

  /**
   * Scrape job listings from the main jobs page
   */
  async getJobListings(maxRecords?: number): Promise<JobListing[]> {
    this.metrics.startTime = new Date();
    this.logger.info('Starting job listings scrape');

    try {
      // Try to load from test scenario first
      const testListings = await this.testDataManager.loadJobListings();
      if (testListings) {
        this.logger.info(`Loaded ${testListings.length} job listings from test scenario`);
        this.metrics.totalJobs = testListings.length;
        this.metrics.successfulScrapes++;
        return testListings;
      }

      // If not in test scenario mode, proceed with normal scraping
      const page = await this.getPage();
      
      // Add longer timeout and better error handling for initial page load
      this.logger.info('Loading initial URL:', this.baseUrl);
      try {
        await page.goto(this.baseUrl, { 
          waitUntil: 'networkidle0',
          timeout: 60000 // Increase timeout to 60 seconds
        });
      } catch (error: any) {
        if (error?.name === 'TimeoutError') {
          this.logger.warn('Initial page load timed out, trying to proceed anyway');
        } else {
          throw error;
        }
      }

      // Log current URL and page content length for debugging
      const currentUrl = await page.url();
      const pageContent = await page.content();
      this.logger.info('Current URL after navigation:', currentUrl);
      this.logger.info(`Page content length: ${pageContent.length} characters`);

      // Set page size if selector exists with better error handling
      try {
        await page.waitForSelector('select[name="pageSize"]', { timeout: 5000 });
        this.logger.info('Found page size selector');
        await page.select('select[name="pageSize"]', '100');
        this.logger.info('Successfully set page size to 100');
        // Wait for page to reload after changing page size
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        this.logger.warn('Page size selector not found or could not be set:', error?.message || 'Unknown error');
        this.logger.info('Continuing with default page size');
      }

      // Wait for job cards with better error handling
      this.logger.info('Waiting for job cards to load...');
      try {
        await page.waitForSelector('.job-card, .search-result-card', { 
          timeout: 10000,
          visible: true 
        });
        this.logger.info('Job cards loaded');
      } catch (error) {
        this.logger.warn('Timeout waiting for job cards, checking if any are present');
        const cards = await page.$$('.job-card, .search-result-card');
        if (cards.length === 0) {
          throw new Error('No job cards found on page');
        }
        this.logger.info(`Found ${cards.length} job cards despite timeout`);
      }

      // Add rate limiting delay
      const rateLimitDelay = 2000;
      const rateLimitJitter = 1000;
      const delay = rateLimitDelay + (Math.random() * rateLimitJitter);
      await new Promise(resolve => setTimeout(resolve, delay));

      const listings = await page.evaluate(() => {
        // Helper function to safely get text content
        const getText = (element: Element, selector: string): string => {
          const el = element.querySelector(selector);
          return el ? el.textContent?.trim() || '' : '';
        };

        // Use more specific selectors for job cards
        const cards = Array.from(document.querySelectorAll('.job-card, .search-result-card'));
        
        return cards.map(element => {
          // Get title and URL - try multiple possible selectors
          const titleElement = 
            element.querySelector('.card-header a') || 
            element.querySelector('[class*="title"] a') ||
            element.querySelector('h2 a') ||
            element.querySelector('a');
            
          const title = titleElement?.querySelector('span')?.textContent?.trim() || 
                       titleElement?.textContent?.trim() || '';
          const jobUrl = (titleElement as HTMLAnchorElement)?.href || '';
          
          // Get dates - try multiple formats
          const dateText = getText(element, '.card-body p') || getText(element, '[class*="date"]');
          let postedDate = '', closingDate = '';
          if (dateText) {
            const dates = dateText.split('-').map((d: string) => d.trim());
            postedDate = dates[0]?.replace(/^(Job posting:|Posted:)/, '').trim();
            closingDate = dates[1]?.replace(/^(Closing date:|Closes:)/, '').trim();
          }
          
          // Get department/agency
          const agency = 
            getText(element, '.job-search-result-right h2') || 
            getText(element, '[class*="department"]') ||
            getText(element, '[class*="agency"]') ||
            'NSW Government'; // Fallback
          
          // Get location
          const location = 
            getText(element, '.nsw-col p:nth-child(3) span') ||
            getText(element, '[class*="location"]') ||
            'NSW'; // Fallback
          
          // Get salary
          const salary = 
            getText(element, '.salary') ||
            getText(element, '[class*="remuneration"]') ||
            getText(element, '[class*="salary"]') ||
            'Not specified';

          // Get job ID
          const id = 
            getText(element, '.job-search-result-ref-no') ||
            getText(element, '[class*="reference"]') ||
            getText(element, '[class*="job-id"]');

          return {
            id,
            title,
            agency,
            location,
            salary,
            closingDate,
            url: jobUrl,
            postedDate,
            jobReference: id // Add jobReference to match JobListing type
          };
        }).filter(job => job.title && job.id); // Only return jobs with at least a title and ID
      });

      // Apply maxRecords limit if specified
      const limitedListings = maxRecords ? listings.slice(0, maxRecords) : listings;
      
      // Save test data if enabled
      if (process.env.SAVE_TEST_DATA === 'true') {
        await this.saveJobListingsData(limitedListings);
      }
      
      // Only log the jobs we're actually going to process
      this.logger.info(`Found ${limitedListings.length} job listings${maxRecords ? ` (limited by maxRecords=${maxRecords})` : ''}`);
      limitedListings.forEach(job => {
        this.logger.info(`Processing job listing: ${job.id}, ${job.title}`);
      });

      this.metrics.totalJobs = limitedListings.length;
      this.metrics.successfulScrapes++;

      await page.close();
      return limitedListings;

    } catch (error) {
      this.metrics.failedScrapes++;
      this.metrics.errors.push({
        url: this.baseUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
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
      this.logger.info(`Saved test data for job ${jobListing.id}`);
    } catch (error) {
      this.logger.error('Error saving job test data:', error);
    }
  }

  /**
   * Scrape detailed job information from a specific job listing
   */
  async getJobDetails(jobListing: JobListing): Promise<JobDetails> {
    this.logger.info(`Scraping details for job: ${jobListing.title}`);
    this.logger.info(`Job URL: ${jobListing.url}`);

    try {
      // Try to load from test scenario first
      const testDetails = await this.testDataManager.loadJobDetails(jobListing.id);
      if (testDetails) {
        this.logger.info(`Loaded job details from test scenario for job ${jobListing.id}`);
        this.metrics.successfulScrapes++;
        return testDetails;
      }

      // If not in test scenario mode, proceed with normal scraping
      const page = await this.getPage();
      await page.goto(jobListing.url, { waitUntil: 'networkidle0' });

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
        url: jobListing.url,
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
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
} 