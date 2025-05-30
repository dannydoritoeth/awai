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
  #baseUrl = "https://iworkfor.nsw.gov.au/jobs/all-keywords/all-agencies/all-organisations-entities/all-categories/all-locations/all-worktypes";

  constructor(options = {}) {
    this.browser = null;
    this.page = null;
    this.maxJobs = options.maxJobs || 100; // Default to 100 jobs
    this.pageSize = options.pageSize || 100; // Default page size
    this.currentJobCount = 0;
  }

  async launch() {
    logger.info(`"${this.#name}" spider launched.`);
    try {
      this.browser = await puppeteer.launch({
        headless: 'new'
      });
      this.page = await this.browser.newPage();
      return await this.#crawl();
    } catch (error) {
      logger.error('Spider error:', error);
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

  #getPageUrl(pageNumber) {
    return `${this.#baseUrl}?page=${pageNumber}&pagesize=${this.pageSize}&sortby=RelevanceDesc`;
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
        let consecutiveEmptyPages = 0;

        while (this.currentJobCount < this.maxJobs && consecutiveEmptyPages < 2) {
          logger.info(`Processing page ${currentPage}`);
          
          if (currentPage > 1) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limiting
            await this.page.goto(this.#getPageUrl(currentPage));
          } else {
            await this.page.goto(this.#getPageUrl(1));
          }

          // Wait for either job cards or no results message
          try {
            await Promise.race([
              this.page.waitForSelector('.job-card', { timeout: 10000 }),
              this.page.waitForSelector('.no-results', { timeout: 10000 })
            ]);
          } catch (error) {
            logger.error(`Timeout waiting for job cards on page ${currentPage}`);
            break;
          }
          
          const jobs = await this.#scrapeJobs();
          if (jobs && jobs.length > 0) {
            consecutiveEmptyPages = 0; // Reset counter when we find jobs
            allJobs = [...allJobs, ...jobs];
            this.currentJobCount += jobs.length;
            logger.info(`Found ${jobs.length} jobs on page ${currentPage}. Total so far: ${this.currentJobCount}`);
          } else {
            consecutiveEmptyPages++;
            logger.warn(`No jobs found on page ${currentPage}. Empty pages: ${consecutiveEmptyPages}`);
            if (consecutiveEmptyPages >= 2) {
              logger.info('Two consecutive empty pages found, stopping pagination');
              break;
            }
          }
          
          if (this.currentJobCount >= this.maxJobs) {
            allJobs = allJobs.slice(0, this.maxJobs);
            logger.info(`Reached maximum job limit of ${this.maxJobs}`);
            break;
          }

          currentPage++;
        }

        logger.info('Job Processing Summary:');
        logger.info(`Total pages processed: ${currentPage}`);
        logger.info(`Total jobs found: ${allJobs.length}`);
        logger.info(`Jobs to process: ${allJobs.length}`);

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
    const jobs = [];
    
    // Get all job listings data
    const jobListings = await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('.job-card')).map(element => {
        const titleElement = element.querySelector('.card-header a');
        const title = titleElement?.querySelector('span')?.textContent?.trim() || '';
        const jobUrl = titleElement?.href || '';
        
        const dateText = element.querySelector('.card-body p')?.textContent?.trim() || '';
        const [postingDate, closingDate] = dateText.split(' - ').map(d => d.replace(/^(Job posting: |Closing date: )/, ''));
        
        const department = element.querySelector('.job-search-result-right h2')?.textContent?.trim() || '';
        const jobType = element.querySelector('.job-search-result-right p span')?.textContent?.trim() || '';
        const jobId = element.querySelector('.job-search-result-ref-no')?.textContent?.trim() || '';
        const location = element.querySelector('.nsw-col p:nth-child(3) span')?.textContent?.trim() || '';
        const salary = element.querySelector('.salary')?.textContent?.trim() || '';
        
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
      });
    });

    return jobListings;
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