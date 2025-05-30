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
  #cachedJobs = new Map();
  #documentHandler;

  constructor(options = {}) {
    this.browser = null;
    this.page = null;
    this.maxJobs = options.maxJobs || 100;
    this.pageSize = 25; // Default page size
    this.currentJobCount = 0;
    this.loadCache();
    this.#documentHandler = new DocumentHandler();
  }

  /**
   * @description Loads previously scraped jobs from the cache
   */
  loadCache() {
    try {
      const cacheDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "database", "jobs");
      
      // Create directories if they don't exist
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
        return;
      }

      // Read all JSON files in the jobs directory
      const files = fs.readdirSync(cacheDir).filter(file => file.endsWith('.json'));
      
      for (const file of files) {
        const content = fs.readFileSync(path.join(cacheDir, file), 'utf8');
        const data = JSON.parse(content);
        
        // Add each job to the cache with its jobId as the key
        if (data.jobs) {
          data.jobs.forEach(job => {
            if (job.jobId && job.details) {
              this.#cachedJobs.set(job.jobId, {
                lastScraped: data.metadata.date_scraped,
                details: job.details
              });
            }
          });
        }
      }
      
      logger.info(`Loaded ${this.#cachedJobs.size} jobs from cache`);
    } catch (error) {
      logger.warn(`Error loading cache: ${error.message}`);
    }
  }

  /**
   * @description Checks if a job needs to be re-scraped based on its ID and last scrape date
   * @param {string} jobId - The job ID to check
   * @returns {Object|null} Returns cached details if valid, null if needs re-scraping
   */
  #checkCache(jobId) {
    if (!this.#cachedJobs.has(jobId)) return null;

    const cached = this.#cachedJobs.get(jobId);
    const lastScraped = new Date(cached.lastScraped);
    const now = new Date();
    
    // Re-scrape if the cache is older than 24 hours
    if (now - lastScraped > 24 * 60 * 60 * 1000) {
      // Remove from cache if expired
      this.#cachedJobs.delete(jobId);
      return null;
    }

    return cached.details;
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
        headless: 'new'
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

        // Get total job count with more robust selector matching
        const totalJobs = await this.page.evaluate(() => {
          const possibleElements = [
            document.querySelector('[class*="search-results-count"]'),
            document.querySelector('[class*="result-count"]'),
            document.querySelector('.total-count'),
            Array.from(document.querySelectorAll('*'))
              .find(el => el.textContent?.includes('jobs match'))
          ];

          const element = possibleElements.find(el => el?.textContent);
          const text = element?.textContent || '';
          console.log('Found results text:', text);

          const matches = text.match(/(\d+)(?:\s+jobs?|(\s+results?)|(\s+match))/i);
          return matches ? parseInt(matches[1]) : 0;
        });

        logger.info(`Total jobs found in text: ${totalJobs}`);

        while (this.currentJobCount < this.maxJobs) {
          logger.info(`Processing page ${currentPage}`);
          
          // Wait for job cards and log count
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
            logger.info(`Successfully scraped ${jobs.length} jobs from page ${currentPage}`);
            allJobs = [...allJobs, ...jobs];
            this.currentJobCount += jobs.length;
          } else {
            logger.warn(`No jobs found on page ${currentPage}, checking page content`);
            const pageContent = await this.page.content();
            logger.info(`Page ${currentPage} content length: ${pageContent.length} characters`);
            break;
          }
          
          if (this.currentJobCount >= this.maxJobs) {
            logger.info(`Reached maximum job limit of ${this.maxJobs}`);
            break;
          }

          // Try to find and click the next button
          try {
            // Wait for the next button to be visible
            await this.page.waitForSelector('button[aria-label="Pagination - Go to Next"]', { timeout: 5000 });
            
            // Check if the button is disabled
            const isDisabled = await this.page.evaluate(() => {
              const nextButton = document.querySelector('button[aria-label="Pagination - Go to Next"]');
              return nextButton?.classList.contains('disabled') || nextButton?.hasAttribute('disabled');
            });

            if (isDisabled) {
              logger.info('Next button is disabled, reached last page');
              break;
            }

            // Click the next button and wait for navigation
            logger.info('Clicking next page button...');
            await Promise.all([
              this.page.waitForNavigation({ waitUntil: 'networkidle0' }),
              this.page.click('button[aria-label="Pagination - Go to Next"]')
            ]);

            // Add a small delay to ensure content is loaded
            await this.page.waitForTimeout(2000);
            
            currentPage++;
            logger.info(`Successfully navigated to page ${currentPage}`);
          } catch (error) {
            logger.error(`Error navigating to next page: ${error.message}`);
            break;
          }
        }

        logger.info('----------------------------------------');
        logger.info(`Total pages processed: ${currentPage}`);
        logger.info(`Total jobs found: ${allJobs.length} / ${totalJobs}`);
        logger.info(`Jobs processed: ${allJobs.length}`);
        logger.info('----------------------------------------');

        return allJobs;
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
      // Wait for job cards with a more flexible selector
      await this.page.waitForSelector('[class*="job-card"], [class*="search-result"]', { timeout: 10000 });
      
      // Get all job listings data
      const jobListings = await this.page.evaluate(() => {
        // Helper function to safely get text content
        const getText = (element, selector) => {
          const el = element.querySelector(selector);
          return el ? el.textContent.trim() : '';
        };

        // Try multiple selectors for job cards
        const cards = Array.from(document.querySelectorAll('[class*="job-card"], [class*="search-result"]'));
        console.log(`Found ${cards.length} potential job cards`); // Debug log

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
      });

      logger.info(`Scraped ${jobListings.length} jobs from current page`);
      return jobListings;
    } catch (error) {
      logger.error(`Error scraping jobs: ${error.message}`);
      return [];
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
} 