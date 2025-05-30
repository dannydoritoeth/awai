import puppeteer from "puppeteer";
import settings from "../settings.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import process from "process";
import fetch from "node-fetch";
import { DocumentHandler } from "../utils/documentHandler.js";
import { logger } from '../utils/logger.js';

/**
 * @description Scrapes jobs from NSW Government jobs website
 */
export class NSWJobSpider {
  #name = "nsw gov jobs";
  #baseUrl = "https://iworkfor.nsw.gov.au";
  #allowedDomains = [
    "https://iworkfor.nsw.gov.au/jobs/all-keywords/all-agencies/all-organisations-entities/all-categories/all-locations/all-worktypes"
  ];
  #documentHandler;
  #rateLimitDelay = 2000; // Base delay between requests
  #rateLimitJitter = 1000; // Random jitter to add to delay

  constructor(options = {}) {
    this.browser = null;
    this.page = null;
    this.maxJobs = options.maxJobs || 5;
    this.pageSize = 25; // Default page size
    this.currentJobCount = 0; // Initialize counter
    this.#documentHandler = new DocumentHandler();
  }

  /**
   * @description Adds a delay between requests with jitter
   * @returns {Promise<void>}
   */
  async #addRateLimitDelay() {
    const jitter = Math.random() * this.#rateLimitJitter;
    const delay = this.#rateLimitDelay + jitter;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * @description Constructs the URL for a specific page
   * @param {number} pageNumber - The page number to fetch
   * @returns {string} The complete URL with pagination parameters
   */
  #getPageUrl(pageNumber) {
    const baseUrl = this.#allowedDomains[0];
    // Use ? for first parameter, & for subsequent ones
    const params = [];
    if (pageNumber > 1) params.push(`page=${pageNumber}`);
    if (this.pageSize) params.push(`pagesize=${this.pageSize}`);
    params.push('sortby=RelevanceDesc');
    
    const url = `${baseUrl}${params.length ? '?' + params.join('&') : ''}`;
    logger.info(`Generated URL for page ${pageNumber}: ${url}`);
    return url;
  }

  async launch() {
    logger.info(`"${this.#name}" spider launched.`);
    try {
      this.browser = await puppeteer.launch({
        ...settings, // Use settings from settings.js which includes headless: false
      });
      this.page = await this.browser.newPage();
      
      // First load the page
      const initialUrl = this.#getPageUrl(1);
      logger.info(`Loading initial URL: ${initialUrl}`);
      
      await this.page.goto(initialUrl);
      
      // Log the actual URL after navigation (in case of redirects)
      const currentUrl = this.page.url();
      logger.info(`Current URL after navigation: ${currentUrl}`);
      
      // Wait for the page size selector and set it to desired size
      try {
        await this.page.waitForSelector('select[name="pageSize"]', { timeout: 5000 });
        logger.info('Found page size selector, attempting to set size');
        await this.page.select('select[name="pageSize"]', this.pageSize.toString());
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for page to reload
        logger.info(`Successfully set page size to ${this.pageSize}`);
      } catch (error) {
        logger.warn(`Could not set page size: ${error.message}`);
      }
      
      // Log page content for debugging
      const pageContent = await this.page.content();
      logger.info(`Page content length: ${pageContent.length} characters`);
      
      // Check if job cards are present
      const jobCards = await this.page.$$('.job-card');
      logger.info(`Found ${jobCards.length} job cards on initial page`);
      
      return await this.#crawl();
    } catch (error) {
      logger.error('Spider launch error:', error);
      await this.#terminate();
      return [];
    }
  }

  async #terminate() {
    if (this.browser) {
      await this.browser.close();
      logger.info(`"${this.#name}" spider terminated.`);
    }
  }

  async #getTotalJobCount(page) {
    try {
      await page.waitForSelector('.search-results-count', { timeout: 5000 });
      const countText = await page.$eval('.search-results-count', el => el.textContent);
      const match = countText.match(/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    } catch (error) {
      logger.error('Error getting total job count:', error);
      return 0;
    }
  }

  async #crawl() {
    logger.info(`"${this.#name}" spider crawling.`);
    try {
      if (this.page) {
        this.page.setDefaultNavigationTimeout(200000);
        
        let allJobs = [];
        let currentPage = 1;

        // Check for job count element with more specific selectors
        const jobCountElement = await this.page.$('[class*="search-results-count"], [class*="result-count"], .total-count');
        if (!jobCountElement) {
          logger.warn('Could not find job count element, checking page structure...');
          const classes = await this.page.evaluate(() => {
            return Array.from(document.querySelectorAll('*'))
              .map(el => el.className)
              .filter(className => className && typeof className === 'string' && className.includes('count'))
              .join(', ');
          });
          logger.info(`Found elements with 'count' in class name: ${classes}`);
        }

        while (allJobs.length < this.maxJobs) {
          logger.info(`Processing page ${currentPage}, current job count: ${allJobs.length}/${this.maxJobs}`);
          
          try {
            await this.page.waitForSelector('[class*="job-card"], [class*="search-result"]', { timeout: 10000 });
            const jobCardsCount = await this.page.$$eval('[class*="job-card"], [class*="search-result"]', cards => cards.length);
            logger.info(`Found ${jobCardsCount} job cards on page ${currentPage}`);
          } catch (error) {
            logger.error(`Error waiting for job cards: ${error.message}`);
            break;
          }
          
          const jobs = await this.#scrapeJobs();
          if (jobs && jobs.length > 0) {
            // Only add up to maxJobs
            const remainingSlots = this.maxJobs - allJobs.length;
            const jobsToAdd = jobs.slice(0, remainingSlots);
            
            allJobs = [...allJobs, ...jobsToAdd];
            
            logger.info(`Added ${jobsToAdd.length} jobs from page ${currentPage}. Total jobs: ${allJobs.length}/${this.maxJobs}`);
            
            if (allJobs.length >= this.maxJobs) {
              logger.info(`Reached maximum job limit of ${this.maxJobs}. Stopping crawl.`);
              break;
            }
          } else {
            logger.warn(`No jobs found on page ${currentPage}, checking page content`);
            const pageContent = await this.page.content();
            logger.info(`Page ${currentPage} content length: ${pageContent.length} characters`);
            break;
          }

          // Try to find and click the next button
          try {
            if (allJobs.length >= this.maxJobs) {
              logger.info(`Job limit reached (${allJobs.length}/${this.maxJobs}). Stopping pagination.`);
              break;
            }

            await this.page.waitForSelector('button[aria-label="Pagination - Go to Next"]', { timeout: 5000 });
            
            const isDisabled = await this.page.evaluate(() => {
              const nextButton = document.querySelector('button[aria-label="Pagination - Go to Next"]');
              return nextButton?.classList.contains('disabled') || nextButton?.hasAttribute('disabled');
            });

            if (isDisabled) {
              logger.info('Next button is disabled, reached last page');
              break;
            }

            logger.info('Clicking next page button...');
            await Promise.all([
              this.page.waitForNavigation({ waitUntil: 'networkidle0' }),
              this.page.click('button[aria-label="Pagination - Go to Next"]')
            ]);

            await this.page.waitForTimeout(2000);
            
            currentPage++;
            logger.info(`Successfully navigated to page ${currentPage}`);
          } catch (error) {
            logger.error(`Error navigating to next page: ${error.message}`);
            break;
          }
        }

        // Ensure we only return maxJobs number of jobs
        const finalJobs = allJobs.slice(0, this.maxJobs);

        logger.info('----------------------------------------');
        logger.info(`Total pages processed: ${currentPage}`);
        logger.info(`Total jobs scraped: ${finalJobs.length} / ${this.maxJobs}`);
        logger.info('----------------------------------------');

        return finalJobs;
      }
      return [];
    } catch (error) {
      logger.error('Crawl error:', error);
      return [];
    } finally {
      await this.#terminate();
    }
  }

  async #scrapeJobs() {
    try {
      // Wait for job cards with a more specific selector - using a more precise selector
      await this.page.waitForSelector('.job-card, .search-result-card', { timeout: 30000 });
      
      // Get all job listings data, but limit to maxJobs
      const jobListings = await this.page.evaluate((maxJobs) => {
        // Helper function to safely get text content
        const getText = (element, selector) => {
          const el = element.querySelector(selector);
          return el ? el.textContent.trim() : '';
        };

        // Use more specific selectors for job cards
        const cards = Array.from(document.querySelectorAll('.job-card, .search-result-card'))
          .slice(0, maxJobs); // Limit the number of cards we process
        console.log(`Processing ${cards.length} job cards`); // Debug log

        return cards.map(element => {
          // Get title and URL - try multiple possible selectors
          const titleElement = 
            element.querySelector('.card-header a') || 
            element.querySelector('[class*="title"] a') ||
            element.querySelector('h2 a') ||
            element.querySelector('a');
            
          const title = titleElement?.querySelector('span')?.textContent?.trim() || 
                       titleElement?.textContent?.trim() || '';
          const jobUrl = titleElement?.href || '';
          
          // Get dates - try multiple formats
          const dateText = getText(element, '.card-body p') || getText(element, '[class*="date"]');
          let postingDate = '', closingDate = '';
          if (dateText) {
            const dates = dateText.split('-').map(d => d.trim());
            postingDate = dates[0]?.replace(/^(Job posting:|Posted:)/, '').trim();
            closingDate = dates[1]?.replace(/^(Closing date:|Closes:)/, '').trim();
          }
          
          // Get department/agency
          const department = 
            getText(element, '.job-search-result-right h2') || 
            getText(element, '[class*="department"]') ||
            getText(element, '[class*="agency"]');
          
          // Get job type
          const jobType = 
            getText(element, '.job-search-result-right p span') ||
            getText(element, '[class*="job-type"]') ||
            getText(element, '[class*="employment-type"]');
          
          // Get job ID
          const jobId = 
            getText(element, '.job-search-result-ref-no') ||
            getText(element, '[class*="reference"]') ||
            getText(element, '[class*="job-id"]');
          
          // Get location
          const location = 
            getText(element, '.nsw-col p:nth-child(3) span') ||
            getText(element, '[class*="location"]');
          
          // Get salary
          const salary = 
            getText(element, '.salary') ||
            getText(element, '[class*="remuneration"]') ||
            getText(element, '[class*="salary"]');

          console.log(`Scraped job: ${title} (${jobId})`); // Debug log
          
          return {
            title,
            department,
            location,
            salary,
            closingDate,
            jobId,
            sourceUrl: jobUrl,
            jobType,
            source: 'iworkfor.nsw.gov.au',
            institution: 'NSW Government'
          };
        }).filter(job => job.title && job.jobId); // Only return jobs with at least a title and ID
      }, this.maxJobs);

      // Fetch job details for each listing with rate limiting
      const jobsWithDetails = [];
      for (const job of jobListings) {
        try {
          // Add rate limiting delay before fetching details
          await this.#addRateLimitDelay();
          
          const details = await this.#scrapeJobDetails(job.sourceUrl, job.jobId);
          if (details) {
            const jobWithDetails = {
              ...job,
              details
            };
            jobsWithDetails.push(jobWithDetails);

            // Upsert to staging_jobs as we process each job
            try {
              await this.#upsertToStagingJobs(jobWithDetails);
              logger.info(`Successfully upserted job ${job.jobId} to staging_jobs`);
            } catch (error) {
              logger.error(`Error upserting job ${job.jobId} to staging_jobs:`, error);
            }
          } else {
            jobsWithDetails.push(job);
          }
        } catch (error) {
          logger.error(`Error fetching details for job ${job.jobId}:`, error);
          jobsWithDetails.push(job);
        }
      }

      logger.info(`Scraped ${jobsWithDetails.length} jobs from current page`);
      return jobsWithDetails;
    } catch (error) {
      logger.error(`Error scraping jobs: ${error.message}`);
      return [];
    }
  }

  /**
   * @description Scrapes detailed job information from the job page
   * @param {string} jobUrl - URL of the job listing
   * @param {string} jobId - ID of the job
   * @returns {Promise<Object>} Detailed job information
   */
  async #scrapeJobDetails(jobUrl, jobId) {
    try {
      logger.info(`Scraping details for job ${jobId} from ${jobUrl}`);
      
      await this.page.goto(jobUrl, { 
        waitUntil: 'networkidle0',
        timeout: 60000 
      });

      // Update selectors to match actual page structure
      const possibleSelectors = [
        '.job-detail-des',           // Primary selector for job details
        '.wrap-content-jobdetail',   // Backup selector
        '.wrap-jobdetail',           // Fallback selector
        '.job-details',              // Keep some original selectors as fallback
        '[class*="job-details"]',
        'main article'
      ];

      let foundSelector = null;
      for (const selector of possibleSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          foundSelector = selector;
          logger.info(`Found job details using selector: ${foundSelector}`);
          break;
        } catch (e) {
          logger.debug(`Selector ${selector} not found, trying next...`);
          continue;
        }
      }

      if (!foundSelector) {
        logger.warn(`No job details selectors found for job ${jobId}`);
        return null;
      }

      // Extract the job details with improved content gathering
      const jobDetails = await this.page.evaluate((selector) => {
        const detailsElement = document.querySelector(selector);
        if (!detailsElement) return null;

        // Get all text content within paragraphs and divs
        const contentElements = Array.from(detailsElement.querySelectorAll('p, div'))
          .filter(el => {
            // Filter out empty elements and those that are just containers
            const text = el.textContent?.trim();
            return text && text.length > 0 && el.children.length < 3;
          })
          .map(el => el.textContent?.trim());

        // Get specific job details from the table if available
        const jobTable = document.querySelector('.table.table-striped.job-summary');
        const tableDetails = {};
        if (jobTable) {
          const rows = jobTable.querySelectorAll('tr');
          rows.forEach(row => {
            const label = row.querySelector('td:first-child')?.textContent?.trim().replace(':', '') || '';
            const value = row.querySelector('td:last-child')?.textContent?.trim() || '';
            if (label && value) {
              tableDetails[label.toLowerCase().replace(/\s+/g, '_')] = value;
            }
          });
        }

        // Get the full HTML content
        const fullContent = detailsElement.innerHTML?.trim() || '';

        return {
          description: fullContent,
          additionalDetails: contentElements,
          tableDetails: tableDetails,
          metadata: {
            lastScraped: new Date().toISOString(),
            selector: selector
          }
        };
      }, foundSelector);

      if (!jobDetails) {
        logger.warn(`Could not extract job details for job ${jobId}`);
        return null;
      }

      // Extract and process documents
      const documents = this.#documentHandler.extractDocumentUrls(jobDetails.description, 'nswgov');
      const processedDocs = [];
      
      for (const doc of documents) {
        try {
          // Instead of downloading to file, get the document content
          const response = await fetch(doc.url);
          if (!response.ok) {
            throw new Error(`Failed to fetch document: ${response.statusText}`);
          }

          const contentType = response.headers.get('content-type');
          const contentLength = response.headers.get('content-length');
          const lastModified = response.headers.get('last-modified');

          // Create document record
          const documentRecord = {
            jobId,
            url: doc.url,
            title: doc.title,
            type: doc.type,
            contentType,
            contentLength: parseInt(contentLength) || 0,
            lastModified: lastModified ? new Date(lastModified) : new Date(),
            status: 'pending',
            source: 'nswgov',
            created_at: new Date(),
            updated_at: new Date()
          };

          // Add to staging_documents
          try {
            await this.#upsertToStagingDocuments(documentRecord);
            logger.info(`Successfully upserted document ${doc.title} for job ${jobId} to staging_documents`);
            processedDocs.push(documentRecord);
          } catch (error) {
            logger.error(`Error upserting document to staging_documents for job ${jobId}:`, error);
          }
        } catch (error) {
          logger.error(`Error processing document for job ${jobId}:`, error);
        }
      }
      
      // Add processed documents to job details
      jobDetails.documents = processedDocs;

      return jobDetails;
    } catch (error) {
      logger.error(`Error scraping job details from ${jobUrl}:`, error);
      return null;
    }
  }

  async #hasNextPage() {
    try {
      // Wait for pagination element
      await this.page.waitForSelector('.pagination', { timeout: 5000 });
      
      // Get current page number from URL since the active class is not reliable
      const url = this.page.url();
      const currentPage = parseInt(new URL(url).searchParams.get('page')) || 1;
      
      // Check if there are more job cards than we've processed
      const jobCards = await this.page.$$('.job-card');
      const hasMoreJobs = jobCards.length === this.pageSize; // If we got a full page, there are likely more
      
      logger.info(`Current page: ${currentPage}, Has more jobs: ${hasMoreJobs}`);
      
      return hasMoreJobs;
    } catch (error) {
      if (error.name === 'TimeoutError') {
        // No pagination found, assume no more pages
        return false;
      }
      logger.error('Error checking for next page:', error);
      return false;
    }
  }

  /**
   * Upserts a job to the staging_jobs collection
   * @param {Object} job - The job to upsert
   * @returns {Promise<void>}
   */
  async #upsertToStagingJobs(job) {
    try {
      // Assuming you have a database connection/client available
      // You'll need to implement this based on your database setup
      const stagingJob = {
        ...job,
        last_updated: new Date(),
        status: 'pending'
      };

      // Example upsert operation - implement based on your actual database
      await db.collection('staging_jobs').updateOne(
        { jobId: job.jobId },
        { $set: stagingJob },
        { upsert: true }
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Upserts a document to the staging_documents collection
   * @param {Object} document - The document to upsert
   * @returns {Promise<void>}
   */
  async #upsertToStagingDocuments(document) {
    try {
      // Assuming you have a database connection/client available
      // You'll need to implement this based on your database setup
      const stagingDocument = {
        ...document,
        last_updated: new Date(),
        status: 'pending'
      };

      // Example upsert operation - implement based on your actual database
      await db.collection('staging_documents').updateOne(
        { 
          jobId: document.jobId,
          url: document.url 
        },
        { $set: stagingDocument },
        { upsert: true }
      );
    } catch (error) {
      throw error;
    }
  }
} 