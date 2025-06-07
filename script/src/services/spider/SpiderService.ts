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
    this.metrics.startTime = new Date();
    this.logger.info('Starting job listings scrape');
    let allListings: JobListing[] = [];

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

      // Save raw HTML if test data saving is enabled
      if (process.env.SAVE_TEST_DATA === 'true') {
        await this.saveRawHtml(pageContent);
      }

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

      // Click the "Advertised date" sort button
      try {
        await page.waitForSelector('a[sortby="Advertised date"]', { timeout: 5000 });
        this.logger.info('Found sort by date button');
        await page.click('a[sortby="Advertised date"]');
        this.logger.info('Successfully clicked sort by date button');
        // Wait for page to reload after changing sort order
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        this.logger.warn('Sort by date button not found or could not be clicked:', error?.message || 'Unknown error');
        this.logger.info('Continuing with default sort order');
      }

      let hasNextPage = true;
      let pageNum = 1;

      while (hasNextPage) {
        this.logger.info(`Scraping page ${pageNum}`);

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

        // Scrape current page
        const pageListings = await page.evaluate(() => {
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
            const url = (titleElement as HTMLAnchorElement)?.href || '';
          
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
          
            // Get job ID/reference number
            const jobId = 
            getText(element, '.job-search-result-ref-no') ||
            getText(element, '[class*="reference"]') ||
              '';

            // Ensure the URL is absolute
            const jobUrl = url ? (url.startsWith('http') ? url : new URL(url, window.location.href).href) : '';

          return {
              id: jobId,
            title,
              jobUrl,
              url: jobUrl, // Set both url and jobUrl to the same absolute URL
              postedDate,
              closingDate,
            agency,
            location,
              jobId,
              salary: 'Not specified' // Default value since salary is required by type
            };
          });
        });

        // Add listings to overall results
        allListings = allListings.concat(pageListings);
        this.logger.info(`Found ${pageListings.length} listings on page ${pageNum}`);

        // Check if we've hit the max records limit
        if (maxRecords && allListings.length >= maxRecords) {
          this.logger.info(`Reached max records limit of ${maxRecords}`);
          allListings = allListings.slice(0, maxRecords);
          break;
        }

        // Check for next page button and if it's disabled
        const nextButton = await page.$('button[aria-label="Pagination - Go to Next"]');
        if (!nextButton) {
          this.logger.info('No next page button found');
          hasNextPage = false;
          continue;
        }

        // Check if next button is disabled
        const isDisabled = await page.evaluate(button => {
          return button.classList.contains('disabled') || button.hasAttribute('disabled');
        }, nextButton);

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
      
      // Save listings data if test data saving is enabled
      if (process.env.SAVE_TEST_DATA === 'true') {
        await this.saveJobListingsData(allListings);
      }

      return allListings;

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
      await this.testDataManager.saveJobListings(listings, this.currentPage);
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

      // Define the type for our link objects
      type RelevantLink = {
        url: string;
        text: string;
        title: string;
        parentText: string;
        dataset: { [key: string]: string | undefined };
        className: string;
      };

      // First extract all links and their titles for raw_json
      const allLinks = await page.evaluate((jobTitle: string) => {
        // Helper function to check if text indicates a relevant document
        const isRelevantDocument = (text: string): boolean => {
          const textLower = text.toLowerCase();
          const jobTitleLower = jobTitle.toLowerCase();
          
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

          // Check if the link text contains significant parts of the job title
          const jobTitleWords = jobTitleLower.split(/[\s-()]+/).filter((word: string) => 
            word.length > 3 && 
            !['the', 'and', 'for', 'with', 'role', 'job', 'position'].includes(word)
          );
          
          // If we find at least 2 significant words from the job title, consider it relevant
          const matchingWords = jobTitleWords.filter((word: string) => textLower.includes(word));
          if (matchingWords.length >= 2) {
            return true;
          }

          // If there's only one word in the job title, match that single word
          if (jobTitleWords.length === 1 && matchingWords.length === 1) {
            return true;
          }

          return false;
        };

        // Only collect links that are likely to be role-related documents
        return Array.from(document.querySelectorAll('a')).reduce<RelevantLink[]>((relevantLinks, link) => {
          const text = link.textContent?.trim() || '';
          const parentText = link.parentElement?.textContent?.trim() || '';
          const url = link.href;
          
          // Skip non-document links
          if (url.startsWith('javascript:') || 
              url === '#' || 
              url.includes('#') ||
              !url.startsWith('http')) {
            return relevantLinks;
          }

          // Skip common utility links
          const skipPatterns = [
            'back to top',
            'email to a friend',
            'sign in',
            'login',
            'contact us',
            'apply online',
            'share',
            'print'
          ];
          
          if (skipPatterns.some(pattern => 
              text.toLowerCase().includes(pattern) || 
              link.title?.toLowerCase().includes(pattern))) {
            return relevantLinks;
          }
          
          // Check if either the link text or its parent context indicates a relevant document
          if (isRelevantDocument(text) || isRelevantDocument(parentText)) {
            relevantLinks.push({
              url: url,
              text: text,
              title: link.getAttribute('title') || '',
              parentText: parentText,
              dataset: Object.fromEntries(Object.entries(link.dataset)),
              className: link.className
            });
          }
          return relevantLinks;
        }, []);
      }, jobListing.title);

      this.logger.info(`Found ${allLinks.length} relevant links:`, allLinks);

      const details = await page.evaluate((listing: JobListing, rawLinks: RelevantLink[]) => {
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

        // Helper function to determine document type
        const getDocumentType = (url: string): string => {
          const urlLower = url.toLowerCase();
          
          // Check file extensions only
          if (urlLower.endsWith('.pdf')) return 'pdf';
          if (urlLower.endsWith('.doc')) return 'doc';
          if (urlLower.endsWith('.docx')) return 'docx';
          
          // For all other URLs, mark as unknown and let DocumentService determine type
          return 'unknown';
        };

        // Convert relevant links to documents
        rawLinks.forEach(link => {
            documents.push({
            url: link.url,
            title: link.text || undefined,
            type: getDocumentType(link.url)
            });
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
          documents,
          raw_json: {
            ...listing,
            all_links: rawLinks,
            extracted_documents: documents,
            agency,
            jobType,
            location,
            jobReference,
            description,
            responsibilities,
            requirements,
            notes,
            aboutUs,
            contactDetails
          }
        };
      }, jobListing, allLinks);

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