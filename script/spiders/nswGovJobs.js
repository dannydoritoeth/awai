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
import PDFParser from 'pdf2json';
import mammoth from 'mammoth';
import { OpenAI } from 'openai';
import { generateNSWCapabilityData } from '../scripts/generateNSWCapabilities.js';
import { generateTaxonomyData } from '../scripts/generateTaxonomyData.js';
import os from 'os';

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
  #supabase;
  #openai;
  #processedRoles = [];
  #maxJobs;
  #institutionId;
  #page;
  #browser;

  constructor({ maxJobs = 10, supabase, institution_id }) {
    try {
      this.browser = null;
      this.page = null;
      this.#maxJobs = maxJobs;
      this.pageSize = 25; // Default page size
      this.currentJobCount = 0; // Initialize counter
      this.#documentHandler = new DocumentHandler();
      
      if (!supabase) {
        throw new Error('Supabase client is required');
      }
      this.#supabase = supabase;

      // Validate supabase connection
      if (!this.#supabase.from) {
        throw new Error('Invalid Supabase client provided');
      }

      // Get or validate institution_id
      if (!institution_id) {
        throw new Error('institution_id is required');
      }
      this.#institutionId = institution_id;

      // Initialize OpenAI
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key is required for content processing');
      }
      this.#openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    } catch (error) {
      logger.error('Error initializing NSWJobSpider:', {
        error: {
          message: error.message,
          stack: error.stack,
          details: error
        }
      });
      throw error;
    }
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
      // Initialize NSW Capability Framework first
      await this.#initializeNSWCapabilityFramework();
      
      // Validate supabase connection before proceeding
      try {
        const { data, error } = await this.#supabase.from('jobs').select('count').limit(1);
        if (error) {
          throw new Error(`Supabase connection test failed: ${error.message}`);
        }
        logger.info('Supabase connection test successful');
      } catch (error) {
        logger.error('Supabase connection test failed:', {
          error: {
            message: error.message,
            stack: error.stack,
            details: error
          }
        });
        throw error;
      }

      this.browser = await puppeteer.launch({
        ...settings,
      });
      this.page = await this.browser.newPage();
      
      // First load the page
      const initialUrl = this.#getPageUrl(1);
      logger.info(`Loading initial URL: ${initialUrl}`);
      
      await this.page.goto(initialUrl);
      
      // Log the actual URL after navigation
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
      
      const jobs = await this.#crawl();

      // Process taxonomies after all roles are collected
      await this.#processTaxonomies(this.#processedRoles);

      // Log processing stats at the end
      await this.#logProcessingStats();

      return jobs;
    } catch (error) {
      logger.error('Spider launch error:', {
        error: {
          message: error.message,
          stack: error.stack,
          details: error
        }
      });
      await this.#terminate();
      throw error; // Re-throw the error to be handled by the caller
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

        while (allJobs.length < this.#maxJobs) {
          logger.info(`Processing page ${currentPage}, current job count: ${allJobs.length}/${this.#maxJobs}`);
          
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
            const remainingSlots = this.#maxJobs - allJobs.length;
            const jobsToAdd = jobs.slice(0, remainingSlots);
            
            allJobs = [...allJobs, ...jobsToAdd];
            
            logger.info(`Added ${jobsToAdd.length} jobs from page ${currentPage}. Total jobs: ${allJobs.length}/${this.#maxJobs}`);
            
            if (allJobs.length >= this.#maxJobs) {
              logger.info(`Reached maximum job limit of ${this.#maxJobs}. Stopping crawl.`);
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
            if (allJobs.length >= this.#maxJobs) {
              logger.info(`Job limit reached (${allJobs.length}/${this.#maxJobs}). Stopping pagination.`);
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
        const finalJobs = allJobs.slice(0, this.#maxJobs);

        logger.info('----------------------------------------');
        logger.info(`Total pages processed: ${currentPage}`);
        logger.info(`Total jobs scraped: ${finalJobs.length} / ${this.#maxJobs}`);
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
            getText(element, '[class*="agency"]') ||
            'NSW Government'; // Fallback to prevent null
          
          // Debug log for department
          console.log(`Department found: ${department}`);
          
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
            getText(element, '[class*="location"]') ||
            'NSW'; // Fallback
          
          // Get salary
          const salary = 
            getText(element, '.salary') ||
            getText(element, '[class*="remuneration"]') ||
            getText(element, '[class*="salary"]') ||
            'Not specified'; // Fallback

          console.log(`Scraped job: ${title} (${jobId}) - Department: ${department}`); // Enhanced debug log
          
          return {
            title,
            department,
            department_name: department, // Use the same department name
            location,
            salary,
            closingDate,
            jobId,
            sourceUrl: jobUrl,
            jobType,
            source: 'nswgov',
            institution: 'NSW Government'
          };
        }).filter(job => job.title && job.jobId); // Only return jobs with at least a title and ID
      }, this.#maxJobs);

      // Fetch job details for each listing with rate limiting
      const jobsWithDetails = [];
      for (const job of jobListings) {
        try {
          logger.info(`Processing job listing: ${JSON.stringify(job)}`);
          
          // Add rate limiting delay before fetching details
          await this.#addRateLimitDelay();
          
          const details = await this.#scrapeJobDetails(job.jobId, job.sourceUrl);
          logger.info(`Scraped details for job ${job.jobId}:`);
          
          if (details) {
            const jobWithDetails = {
              ...job,
              details
            };

            try {
              // 1. Upsert company/department
              const companyData = await this.#upsertToStagingCompany(job);
              logger.info(`Company upsert result:`, { companyData });

              // 2. Process the job
              const processedJob = await this.#processJob(job.jobId, {
                ...jobWithDetails,
                company_id: companyData[0]?.id
              });
              logger.info('Job processing result:', { jobId: processedJob?.job?.jobId });

              jobsWithDetails.push(processedJob);
            } catch (processingError) {
              logger.error(`Error processing job ${job.jobId}:`, {
                error: {
                  message: processingError.message,
                  stack: processingError.stack,
                  cause: processingError.cause
                },
                job: jobWithDetails
              });
              // Continue with next job
              continue;
            }
          }
        } catch (jobError) {
          logger.error(`Error processing job listing ${job.jobId}:`, {
            error: {
              message: jobError.message,
              stack: jobError.stack,
              cause: jobError.cause
            },
            job
          });
          // Continue with next job
          continue;
        }
      }

      logger.info(`Scraped ${jobsWithDetails.length} jobs from current page`);
      return jobsWithDetails;
    } catch (error) {
      logger.error(`Error scraping jobs:`, {
        error: {
          message: error.message,
          stack: error.stack,
          cause: error.cause
        }
      });
      return [];
    }
  }

  /**
   * @description Scrapes detailed job information from the job page
   * @param {string} jobId - ID of the job
   * @param {string} url - URL of the job listing
   * @returns {Promise<Object>} Detailed job information
   */
  async #scrapeJobDetails(jobId, url) {
    try {
      logger.info(`Scraping details for job ${jobId} from ${url}`);
      
      await this.page.goto(url, { waitUntil: 'networkidle0' });
      
      // Try multiple selectors for job details
      const detailsSelectors = [
        '.job-detail-des',
        '.job-details',
        '[class*="job-detail"]',
        '[class*="job-description"]'
      ];
      
      let foundSelector = null;
      for (const selector of detailsSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          foundSelector = selector;
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!foundSelector) {
        throw new Error('Could not find job details container with any known selector');
      }
      
      logger.info(`Found job details using selector: ${foundSelector}`);
      
      // Log the HTML structure around the job details
      const htmlStructure = await this.page.evaluate(() => {
        const container = document.querySelector('.job-detail-des') || 
                         document.querySelector('.job-details') ||
                         document.querySelector('[class*="job-detail"]');
        return container ? container.outerHTML.slice(0, 500) : 'Not found';
      });
      
      logger.debug('Job details HTML structure:', {
        jobId,
        htmlStructure: htmlStructure.substring(0, 200) + '...' // Log first 200 chars
      });
      
      const jobDetails = await this.page.evaluate(() => {
        // Helper function to try multiple selectors
        const getTextContent = (selectors) => {
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
              return element.textContent.trim();
            }
          }
          return '';
        };

        const details = {};
        
        // Get basic details with multiple selector fallbacks
        details.title = getTextContent(['h1', '.job-title', '[class*="title"]']);
        details.department = getTextContent([
          '.agency-name',
          '.department-name',
          '[class*="agency"]',
          '[class*="department"]'
        ]);
        details.location = getTextContent([
          '.location',
          '[class*="location"]',
          '[class*="address"]'
        ]);
        details.salary = getTextContent([
          '.salary',
          '[class*="salary"]',
          '[class*="remuneration"]'
        ]);
        details.closingDate = getTextContent([
          '.closing-date',
          '[class*="closing"]',
          '[class*="deadline"]'
        ]);
        
        // Get role details
        details.role = getTextContent([
          '.role-type',
          '.position-type',
          '[class*="role"]',
          '[class*="position"]'
        ]);
        
        // Get description - try multiple containers
        const descriptionContent = getTextContent([
          '.job-detail-des',
          '.job-details',
          '[class*="description"]',
          '[class*="content"]'
        ]);
        details.description = descriptionContent;

        // Get skills and capabilities section
        const skillsContent = Array.from(document.querySelectorAll([
          '.capabilities li',
          '.skills li',
          '.requirements li',
          '[class*="skill"] li',
          '[class*="capability"] li'
        ].join(', '))).map(li => li.textContent.trim()).filter(text => text.length > 0);
        
        if (skillsContent.length > 0) {
          details.skills = skillsContent;
        }

        // Get categories/classifications
        details.category = getTextContent([
          '.job-category',
          '.classification',
          '[class*="category"]',
          '[class*="classification"]'
        ]);
        
        return details;
      });
      
      // Log what we found
      logger.debug('Extracted job details:', {
        jobId,
        foundFields: Object.keys(jobDetails).filter(k => jobDetails[k] && jobDetails[k].length > 0)
      });
      
      // Add job ID and source URL
      jobDetails.jobId = jobId;
      jobDetails.sourceUrl = url;
      
      // Find and process documents
      const documents = await this.#findJobDocuments(jobId);
      if (documents && documents.length > 0) {
        jobDetails.documents = documents;
      }
      
      return jobDetails;
    } catch (error) {
      logger.error('Error scraping job details:', {
        jobId,
        url,
        error: {
          message: error.message,
          stack: error.stack,
          details: error
        }
      });
      throw error;
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
      if (!this.#supabase) {
        throw new Error('Supabase client not initialized');
      }

      // Validate required fields
      if (!job.jobId) {
        throw new Error('Job ID is required for staging jobs');
      }

      const stagingJob = {
        institution_id: this.#institutionId,
        source_id: 'nswgov',
        original_id: job.jobId, // Ensure this is set from job.jobId
        raw_data: {
          id: job.jobId,
          title: job.title,
          department: job.department,
          location: job.location,
          salary: job.salary,
          closing_date: job.closingDate,
          description: job.details?.description || '',
          company_id: job.company_id,
          source_url: job.sourceUrl,
          job_type: job.jobType,
          source: 'nswgov',
          institution: 'NSW Government',
          documents: job.details?.documents || [],
          skills: job.details?.skills || [],
          category: job.details?.category,
          processing_status: 'pending'
        },
        processed: false,
        validation_status: 'pending'
      };

      // Log the job data before upserting
      logger.debug('Attempting to upsert job:', {
        jobId: job.jobId,
        data: stagingJob
      });

      const { data, error } = await this.#supabase
        .from('jobs')
        .upsert(
          stagingJob,
          { 
            onConflict: 'institution_id,external_id',
            returning: true 
          }
        );

      if (error) {
        throw error;
      }

      logger.info(`Successfully upserted job ${job.jobId} to jobs`);
      return data;
    } catch (error) {
      logger.error('Error in upsertToStagingJobs:', {
        jobId: job.jobId,
        error: {
          message: error.message,
          stack: error.stack,
          code: error.code,
          details: error
        }
      });
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
      if (!this.#supabase) {
        throw new Error('Supabase client not initialized');
      }

      const stagingDocument = {
        institution_id: this.#institutionId,
        source_id: 'nswgov',
        external_id: document.url,
        raw_content: {
          url: document.url,
          title: document.title,
          type: document.type,
          lastModified: document.lastModified,
          source: document.source
        },
        scraped_at: new Date(),
        processing_status: 'pending',
        metadata: {
          jobId: document.jobId
        }
      };

      // Log the document data before upserting
      logger.debug('Attempting to upsert document:', {
        jobId: document.jobId,
        url: document.url,
        data: stagingDocument
      });

      const { data, error } = await this.#supabase
        .from('documents')
        .upsert(
          stagingDocument,
          { 
            onConflict: 'institution_id,source_id,external_id',
            returning: true 
          }
        );

      if (error) {
        throw error;
      }

      logger.info(`Successfully upserted document "${document.title}" for job ${document.jobId}`);
      return data;
    } catch (error) {
      logger.error('Error in upsertToStagingDocuments:', {
        jobId: document.jobId,
        docUrl: document.url,
        error: {
          message: error.message,
          stack: error.stack,
          code: error.code,
          details: error
        }
      });
      throw error;
    }
  }

  async #upsertToStagingCompany(company) {
    try {
      if (!company) {
        throw new Error('Company object is required');
      }

      // Ensure we have a valid company name
      const companyName = (company.name || company.department || '').trim();
      if (!companyName) {
        throw new Error('Company name is required');
      }

      // Generate a slug from the company name
      const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      const { data, error } = await this.#supabase
        .from('companies')
        .upsert({
          institution_id: this.#institutionId,
          name: companyName,
          description: company.description || `${companyName} - NSW Government`,
          website: company.website || 'https://www.nsw.gov.au',
          slug: slug,
          sync_status: 'pending',
          last_synced_at: new Date().toISOString(),
          raw_data: company
        }, {
          onConflict: 'institution_id,slug',
          returning: true
        })
        .select();

      if (error) throw error;
      logger.info(`Successfully upserted company: ${companyName}`);
      return data;
    } catch (error) {
      logger.error('Error upserting company:', {
        company: company?.name || company?.department || 'Unknown',
        error: {
          message: error.message,
          stack: error.stack,
          details: error
        }
      });
      throw error;
    }
  }

  async #upsertToStagingRole(role) {
    try {
      const { data, error } = await this.#supabase
        .from('roles')
        .upsert({
          institution_id: this.#institutionId,
          source_id: 'nswgov',
          external_id: role.id,
          title: role.title,
          division_id: role.division_id,
          grade_band: role.grade_band,
          location: role.location,
          anzsco_code: role.anzsco_code,
          pcat_code: role.pcat_code,
          primary_purpose: role.primary_purpose,
          raw_data: role,
          processing_status: 'pending'
        }, {
          onConflict: 'institution_id,source_id,external_id',
          returning: true
        });

      if (error) throw error;
      logger.info(`Successfully upserted role: ${role.title}`);
      return data;
    } catch (error) {
      logger.error('Error upserting role:', {
        role: role.title,
        error: {
          message: error.message,
          stack: error.stack,
          details: error
        }
      });
      throw error;
    }
  }

  async #upsertToStagingCapability(capability, companyData) {
    try {
        const { data, error } = await this.#supabase
            .from('capabilities')
            .upsert({
                name: capability.name,
                description: capability.description || '',
                source_framework: 'NSW Government Capability Framework',
                is_occupation_specific: false,
                normalized_key: capability.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                company_id: companyData[0].id
            }, {
                onConflict: 'normalized_key,company_id'
            })
            .select();

        if (error) throw error;
        logger.info(`Successfully upserted capability: ${capability.name}`);
        return data;
    } catch (error) {
        logger.error('Error storing capability:', {
            capability: capability.name,
            error: {
                message: error.message,
                stack: error.stack,
                details: error
            }
        });
        throw error;
    }
  }

  async #upsertToStagingSkill(skill, companyData) {
    try {
        const { data, error } = await this.#supabase
            .from('skills')
            .upsert({
                name: skill.name,
                description: skill.description || '',
                source: skill.source || 'job_description',
                is_occupation_specific: true,
                company_id: companyData[0].id,
                category: 'Technical'
            })
            .select();

        if (error) throw error;
        logger.info(`Successfully upserted skill: ${skill.name}`);
        return data;
    } catch (error) {
        logger.error('Error storing skill:', {
            skill: skill.name,
            error: {
                message: error.message,
                stack: error.stack,
                details: error
            }
        });
        throw error;
    }
  }

  async #upsertToStagingTaxonomy(taxonomy) {
    try {
      const { data, error } = await this.#supabase
        .from('taxonomies')
        .upsert({
          institution_id: this.#institutionId,
          source_id: 'nswgov',
          external_id: taxonomy.id,
          name: taxonomy.name,
          description: taxonomy.description,
          taxonomy_type: taxonomy.taxonomy_type,
          raw_data: taxonomy,
          processing_status: 'pending'
        }, {
          onConflict: 'institution_id,source_id,external_id',
          returning: true
        });

      if (error) throw error;
      logger.info(`Successfully upserted taxonomy: ${taxonomy.name}`);
      return data;
    } catch (error) {
      logger.error('Error upserting taxonomy:', {
        taxonomy: taxonomy.name,
        error: {
          message: error.message,
          stack: error.stack,
          details: error
        }
      });
      throw error;
    }
  }

  async #upsertToStagingJobDocument(jobId, documentId) {
    try {
      const { data, error } = await this.#supabase
        .from('job_documents')
        .upsert({
          job_id: jobId,
          document_id: documentId,
          institution_id: this.#institutionId,
          source_id: 'nswgov',
          processing_status: 'pending'
        }, {
          onConflict: 'institution_id,job_id,document_id',
          returning: true
        });

      if (error) throw error;
      logger.info(`Successfully upserted job document relationship: ${jobId} -> ${documentId}`);
      return data;
    } catch (error) {
      logger.error('Error upserting job document:', {
        jobId,
        documentId,
        error: {
          message: error.message,
          stack: error.stack,
          details: error
        }
      });
      throw error;
    }
  }

  async #upsertToStagingRoleDocument(roleId, documentId) {
    try {
      const { data, error } = await this.#supabase
        .from('role_documents')
        .upsert({
          role_id: roleId,
          document_id: documentId,
          institution_id: this.#institutionId,
          source_id: 'nswgov',
          processing_status: 'pending'
        }, {
          onConflict: 'institution_id,role_id,document_id',
          returning: true
        });

      if (error) throw error;
      logger.info(`Successfully upserted role document relationship: ${roleId} -> ${documentId}`);
      return data;
    } catch (error) {
      logger.error('Error upserting role document:', {
        roleId,
        documentId,
        error: {
          message: error.message,
          stack: error.stack,
          details: error
        }
      });
      throw error;
    }
  }

  async #upsertToStagingRoleSkill(roleId, skillId) {
    try {
      const { data, error } = await this.#supabase
        .from('role_skills')
        .upsert({
          role_id: roleId,
          skill_id: skillId,
          institution_id: this.#institutionId,
          source_id: 'nswgov',
          processing_status: 'pending'
        }, {
          onConflict: 'institution_id,role_id,skill_id',
          returning: true
        });

      if (error) throw error;
      logger.info(`Successfully upserted role skill relationship: ${roleId} -> ${skillId}`);
      return data;
    } catch (error) {
      logger.error('Error upserting role skill:', {
        roleId,
        skillId,
        error: {
          message: error.message,
          stack: error.stack,
          details: error
        }
      });
      throw error;
    }
  }

  async #upsertToStagingRoleCapability(roleId, capabilityId, capabilityType, level) {
    try {
      const { data, error } = await this.#supabase
        .from('role_capabilities')
        .upsert({
          role_id: roleId,
          capability_id: capabilityId,
          capability_type: capabilityType,
          level: level,
          institution_id: this.#institutionId,
          source_id: 'nswgov',
          processing_status: 'pending'
        }, {
          onConflict: 'institution_id,role_id,capability_id,capability_type',
          returning: true
        });

      if (error) throw error;
      logger.info(`Successfully upserted role capability relationship: ${roleId} -> ${capabilityId} (${capabilityType})`);
      return data;
    } catch (error) {
      logger.error('Error upserting role capability:', {
        roleId,
        capabilityId,
        capabilityType,
        error: {
          message: error.message,
          stack: error.stack,
          details: error
        }
      });
      throw error;
    }
  }

  async #upsertToStagingRoleTaxonomy(roleId, taxonomyId) {
    try {
      const { data, error } = await this.#supabase
        .from('role_taxonomies')
        .upsert({
          role_id: roleId,
          taxonomy_id: taxonomyId,
          institution_id: this.#institutionId,
          source_id: 'nswgov',
          processing_status: 'pending'
        }, {
          onConflict: 'institution_id,role_id,taxonomy_id',
          returning: true
        });

      if (error) throw error;
      logger.info(`Successfully upserted role taxonomy relationship: ${roleId} -> ${taxonomyId}`);
      return data;
    } catch (error) {
      logger.error('Error upserting role taxonomy:', {
        roleId,
        taxonomyId,
        error: {
          message: error.message,
          stack: error.stack,
          details: error
        }
      });
      throw error;
    }
  }

  async #upsertToStagingCapabilityLevel(level) {
    try {
      const { data, error } = await this.#supabase
        .from('capability_levels')
        .upsert({
          institution_id: this.#institutionId,
          source_id: 'nswgov',
          external_id: level.id,
          capability_id: level.capability_id,
          level: level.level,
          summary: level.summary,
          behavioral_indicators: level.behavioral_indicators,
          processing_status: 'pending'
        }, {
          onConflict: 'institution_id,source_id,external_id',
          returning: true
        });

      if (error) throw error;
      logger.info(`Successfully upserted capability level: ${level.level} for capability ${level.capability_id}`);
      return data;
    } catch (error) {
      logger.error('Error upserting capability level:', {
        level: level.level,
        capability_id: level.capability_id,
        error: {
          message: error.message,
          stack: error.stack,
          details: error
        }
      });
      throw error;
    }
  }

  async #logProcessingStats() {
    try {
      logger.info('\n----------------------------------------');
      logger.info('ETL Processing Summary:');
      logger.info('----------------------------------------');

      // 1. Companies
      const { count: companiesCount } = await this.#supabase
        .from('companies')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', this.#institutionId)
        .eq('source_id', 'nswgov');
      logger.info(`✓ Companies: ${companiesCount} records processed to staging`);

      // 2. Divisions
      const { count: divisionsCount } = await this.#supabase
        .from('divisions')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', this.#institutionId)
        .eq('source_id', 'nswgov');
      logger.info(`✓ Divisions: ${divisionsCount} records processed to staging`);

      // 3. Roles
      const { count: rolesCount } = await this.#supabase
        .from('roles')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', this.#institutionId)
        .eq('source_id', 'nswgov');
      logger.info(`✓ Roles: ${rolesCount} records processed to staging`);

      // 4. Capabilities
      const { count: capabilitiesCount } = await this.#supabase
        .from('capabilities')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', this.#institutionId)
        .eq('source_id', 'nswgov');
      logger.info(`✓ Capabilities: ${capabilitiesCount} records processed to staging`);

      // 5. Capability Levels
      const { count: capabilityLevelsCount } = await this.#supabase
        .from('capability_levels')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', this.#institutionId)
        .eq('source_id', 'nswgov');
      logger.info(`✓ Capability Levels: ${capabilityLevelsCount} records processed to staging`);

      // 6. Skills
      const { count: skillsCount } = await this.#supabase
        .from('skills')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', this.#institutionId)
        .eq('source_id', 'nswgov');
      logger.info(`✓ Skills: ${skillsCount} records processed to staging`);

      // 7. Role Capabilities
      const { count: roleCapabilitiesCount } = await this.#supabase
        .from('role_capabilities')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', this.#institutionId)
        .eq('source_id', 'nswgov');
      logger.info(`✓ Role Capabilities: ${roleCapabilitiesCount} records processed to staging`);

      // 8. Role Skills
      const { count: roleSkillsCount } = await this.#supabase
        .from('role_skills')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', this.#institutionId)
        .eq('source_id', 'nswgov');
      logger.info(`✓ Role Skills: ${roleSkillsCount} records processed to staging`);

      // 9. Jobs
      const { count: jobsCount } = await this.#supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', this.#institutionId)
        .eq('source_id', 'nswgov');
      logger.info(`✓ Jobs: ${jobsCount} records processed to staging`);

      // 10. Job Documents
      const { count: jobDocumentsCount } = await this.#supabase
        .from('job_documents')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', this.#institutionId)
        .eq('source_id', 'nswgov');
      logger.info(`✓ Job Documents: ${jobDocumentsCount} records processed to staging`);

      // 11. Role Documents
      const { count: roleDocumentsCount } = await this.#supabase
        .from('role_documents')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', this.#institutionId)
        .eq('source_id', 'nswgov');
      logger.info(`✓ Role Documents: ${roleDocumentsCount} records processed to staging`);

      // 12. Taxonomies
      const { count: taxonomiesCount } = await this.#supabase
        .from('taxonomies')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', this.#institutionId)
        .eq('source_id', 'nswgov');
      logger.info(`✓ Taxonomies: ${taxonomiesCount} records processed to staging`);

      // 13. Role Taxonomies
      const { count: roleTaxonomiesCount } = await this.#supabase
        .from('role_taxonomies')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', this.#institutionId)
        .eq('source_id', 'nswgov');
      logger.info(`✓ Role Taxonomies: ${roleTaxonomiesCount} records processed to staging`);

      logger.info('----------------------------------------');
      logger.info('Total Records by Type:');
      logger.info('----------------------------------------');
      logger.info(`Companies: ${companiesCount}`);
      logger.info(`Divisions: ${divisionsCount}`);
      logger.info(`Roles: ${rolesCount}`);
      logger.info(`Capabilities: ${capabilitiesCount}`);
      logger.info(`Capability Levels: ${capabilityLevelsCount}`);
      logger.info(`Skills: ${skillsCount}`);
      logger.info(`Role Capabilities: ${roleCapabilitiesCount}`);
      logger.info(`Role Skills: ${roleSkillsCount}`);
      logger.info(`Jobs: ${jobsCount}`);
      logger.info(`Job Documents: ${jobDocumentsCount}`);
      logger.info(`Role Documents: ${roleDocumentsCount}`);
      logger.info(`Taxonomies: ${taxonomiesCount}`);
      logger.info(`Role Taxonomies: ${roleTaxonomiesCount}`);
      logger.info('----------------------------------------');

    } catch (error) {
      logger.error('Error getting processing stats:', {
        error: {
          message: error.message,
          stack: error.stack,
          details: error
        }
      });
    }
  }

  /**
   * Helper method to extract capabilities from job details
   */
  #extractCapabilities(details) {
    const capabilities = [];
    const capabilityKeywords = ['capability', 'competency', 'proficiency'];
    
    // Extract from table details
    if (details.tableDetails?.capabilities) {
      const tableCapabilities = details.tableDetails.capabilities.split(',').map(c => c.trim());
      tableCapabilities.forEach(cap => {
        capabilities.push({
          id: `cap_${cap.toLowerCase().replace(/\s+/g, '_')}`,
          name: cap,
          source_framework: 'NSW Government Capability Framework',
          is_occupation_specific: false
        });
      });
    }

    // Extract from additional details
    details.additionalDetails?.forEach(detail => {
      const lowerDetail = detail.toLowerCase();
      if (capabilityKeywords.some(keyword => lowerDetail.includes(keyword))) {
        // Use regex to extract capability and level if present
        const match = detail.match(/([^:]+)(?::\s*)(.*)/);
        if (match) {
          capabilities.push({
            id: `cap_${match[1].toLowerCase().replace(/\s+/g, '_')}`,
            name: match[1].trim(),
            description: match[2].trim(),
            source_framework: 'NSW Government Capability Framework',
            is_occupation_specific: false
          });
        }
      }
    });

    return capabilities;
  }

  /**
   * Helper method to extract skills from job details
   */
  #extractSkills(details) {
    const skills = [];
    const skillKeywords = ['skill', 'expertise', 'knowledge'];
    
    // Extract from table details
    if (details.tableDetails?.skills) {
      const tableSkills = details.tableDetails.skills.split(',').map(s => s.trim());
      tableSkills.forEach(skill => {
        skills.push({
          id: `skill_${skill.toLowerCase().replace(/\s+/g, '_')}`,
          name: skill,
          source: 'NSW Government Job Description',
          is_occupation_specific: true
        });
      });
    }

    // Extract from additional details
    details.additionalDetails?.forEach(detail => {
      const lowerDetail = detail.toLowerCase();
      if (skillKeywords.some(keyword => lowerDetail.includes(keyword))) {
        // Use regex to extract skill and description if present
        const match = detail.match(/([^:]+)(?::\s*)(.*)/);
        if (match) {
          skills.push({
            id: `skill_${match[1].toLowerCase().replace(/\s+/g, '_')}`,
            name: match[1].trim(),
            description: match[2].trim(),
            source: 'NSW Government Job Description',
            is_occupation_specific: true
          });
        }
      }
    });

    return skills;
  }

  /**
   * Helper method to extract taxonomies from job details
   */
  #extractTaxonomies(details) {
    const taxonomies = [];
    const taxonomyKeywords = ['category', 'classification', 'type'];
    
    // Extract from table details
    if (details.tableDetails?.category) {
      taxonomies.push({
        id: `tax_${details.tableDetails.category.toLowerCase().replace(/\s+/g, '_')}`,
        name: details.tableDetails.category,
        taxonomy_type: 'job_category'
      });
    }

    // Extract from additional details
    details.additionalDetails?.forEach(detail => {
      const lowerDetail = detail.toLowerCase();
      if (taxonomyKeywords.some(keyword => lowerDetail.includes(keyword))) {
        // Use regex to extract taxonomy and description if present
        const match = detail.match(/([^:]+)(?::\s*)(.*)/);
        if (match) {
          taxonomies.push({
            id: `tax_${match[1].toLowerCase().replace(/\s+/g, '_')}`,
            name: match[1].trim(),
            description: match[2].trim(),
            taxonomy_type: 'job_category'
          });
        }
      }
    });

    return taxonomies;
  }

  async #initializeNSWCapabilityFramework() {
    logger.info('Initializing NSW Capability Framework...');
    try {
        await generateNSWCapabilityData(this.#supabase, this.#institutionId);
    } catch (error) {
        logger.error('Error initializing NSW Capability Framework:', {
            code: error.code,
            details: error.details,
            hint: error.hint,
            message: error.message
        });
        throw error;
    }
  }

  async #processTaxonomies(roles) {
    try {
      logger.info('Processing role taxonomies...');
      
      if (!roles || roles.length === 0) {
        logger.warn('No roles to process for taxonomies');
        return;
      }
      
      // Initialize taxonomy data structure
      const taxonomyData = {
        institution_id: this.#institutionId,
        source_id: 'nswgov',
        classifications: roles.map(role => ({
          name: role.title || 'Unspecified Role',
          department: role.department || 'Unspecified Department',
          type: role.role || 'Unspecified Type'
        }))
      };
      
      // Generate and upsert taxonomy data
      await generateTaxonomyData(this.#supabase, taxonomyData);
      
      logger.info('Taxonomy processing completed successfully');
    } catch (error) {
      logger.error('Error processing taxonomies:', {
        error: {
          message: error.message,
          stack: error.stack,
          details: error
        }
      });
      throw error;
    }
  }

  async #processDocumentContent(buffer, type) {
    try {
      let content = null;
      
      // Create a temporary file to store the buffer
      const tempFile = path.join(os.tmpdir(), `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`);
      fs.writeFileSync(tempFile, buffer);

      try {
      if (type.includes('pdf')) {
          const pdfParser = new PDFParser(null, 1);
          content = await new Promise((resolve, reject) => {
            pdfParser.on("pdfParser_dataReady", pdfData => {
              try {
                const text = decodeURIComponent(pdfParser.getRawTextContent())
                  .replace(/\r\n/g, '\n')
                  .replace(/\n{3,}/g, '\n\n')
                  .trim();
                resolve(text);
              } catch (error) {
                reject(error);
              }
            });
            pdfParser.on("pdfParser_dataError", errData => reject(errData));
            pdfParser.loadPDF(tempFile);
          });
      } else if (type.includes('word') || type.includes('docx')) {
          const result = await mammoth.extractRawText({ path: tempFile });
          content = result.value.trim();
        }
      } finally {
        // Clean up temp file
        try {
          fs.unlinkSync(tempFile);
        } catch (e) {
          logger.warn(`Failed to clean up temp file: ${tempFile}`, e);
        }
      }

      if (content) {
        // Extract capabilities and skills using OpenAI
        const analysis = await this.#extractCapabilitiesAndSkills(content);
        return {
          content,
          analysis
        };
      }
      return null;
    } catch (error) {
      logger.error('Error processing document content:', error);
      return null;
    }
  }

  async #extractCapabilitiesAndSkills(content, companyData) {
    try {
      const response = await this.#openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: `You are an expert in analyzing job descriptions and role documents to extract capabilities and skills based on the NSW Government Capability Framework. Extract capabilities with their levels (Foundational, Intermediate, Adept, Advanced, Highly Advanced) and any specific skills mentioned. Format your response as a JSON object with two arrays: 'capabilities' and 'skills'. For capabilities, include the name, level, and any behavioral indicators found. For skills, include the name and any relevant context.`
          },
          {
            role: "user",
            content: `Extract capabilities and skills from this document:\n\n${content}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });

      const result = response.choices[0].message.content;
      if (!result) {
        throw new Error('No content returned from OpenAI');
      }
      
      try {
        // Parse the response into structured data
        const parsed = JSON.parse(result);
        
        // Process capabilities
        if (parsed.capabilities?.length > 0) {
          for (const capability of parsed.capabilities) {
            try {
              const capabilityData = {
                name: capability.name,
                description: capability.description || '',
                source_framework: 'NSW Government Capability Framework',
                is_occupation_specific: false,
                normalized_key: capability.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
              };
              
              await this.#upsertToStagingCapability(capabilityData, companyData);
            } catch (error) {
              logger.error(`Error processing capability for job:`, { error, capability });
            }
          }
        }

        // Process skills
        if (parsed.skills?.length > 0) {
          for (const skill of parsed.skills) {
            try {
              const skillData = {
                name: skill.name,
                description: skill.description || '',
                source: 'job_description',
                is_occupation_specific: true,
                category: 'Technical'
              };
              
              await this.#upsertToStagingSkill(skillData, companyData);
            } catch (error) {
              logger.error(`Error processing skill for job:`, { error, skill });
            }
          }
        }

        return {
          capabilities: parsed.capabilities || [],
          skills: parsed.skills || []
        };
      } catch (parseError) {
        logger.error('Error parsing OpenAI response:', {
          error: {
            message: parseError instanceof Error ? parseError.message : String(parseError),
            response: result
          }
        });
        return { capabilities: [], skills: [] };
      }
    } catch (error) {
      logger.error('Error calling OpenAI:', {
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          details: error instanceof Error ? error : undefined
        }
      });
      return { capabilities: [], skills: [] };
    }
  }

  async #findJobDocuments(jobId) {
    try {
      logger.info(`Finding documents for job ${jobId}...`);
      const documents = await this.page.evaluate(() => {
        const links = [];
        const allLinks = document.querySelectorAll('a');
        
        allLinks.forEach(link => {
          const href = link.href;
          const text = link.textContent?.trim();
          if (!href || !text) return;
          
          const docKeywords = ['position description', 'role description', 'pd', 'click here', 'view the role'];
          const isDocLink = docKeywords.some(keyword => 
            text.toLowerCase().includes(keyword) || 
            href.toLowerCase().includes(keyword)
          );
          
          if (isDocLink) {
            links.push({
              url: href,
              text: text,
              type: href.toLowerCase().includes('.pdf') ? 'pdf' : 
                    href.toLowerCase().includes('.doc') ? 'word' : 'unknown'
            });
          }
        });
        
        return links;
      });
      
      logger.info(`Found ${documents.length} potential documents:`, {
        documents: documents.map(d => ({ url: d.url, type: d.type }))
      });
      
      return documents;
    } catch (error) {
      logger.error(`Error finding documents for job ${jobId}:`, {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: error.cause
        },
        jobId
      });
      throw error;
    }
  }

  async #downloadDocument(url) {
    try {
      logger.info(`Downloading document from ${url}...`);
      
      const response = await fetch(url);
      if (!response.ok) {
        const error = new Error(`Failed to download document: ${response.status} ${response.statusText}`);
        error.response = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          url: response.url
        };
        throw error;
      }
      
      const buffer = await response.arrayBuffer();
      logger.info(`Successfully downloaded document`, {
        url,
        size: buffer.byteLength,
        type: response.headers.get('content-type')
      });
      
      return Buffer.from(buffer);
    } catch (error) {
      logger.error('Error downloading document:', {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: error.cause,
          response: error.response
        },
        url
      });
      throw error;
    }
  }

  async #processJobDetails(jobId, details, companyData) {
    try {
        // Store job details with the correct conflict key
        const { data: jobData, error: jobError } = await this.#supabase
            .from('jobs')
            .upsert({
                company_id: companyData[0].id,
                source_id: 'nswgov',
                original_id: jobId,
                title: details.title,
                department: details.department,
                job_type: details.jobType,
                source_url: details.sourceUrl,
                remuneration: details.salary,
                close_date: details.closingDate ? new Date(details.closingDate) : null,
                locations: [details.location],
                sync_status: 'pending',
                last_synced_at: new Date().toISOString(),
                raw_data: details
            }, {
                onConflict: 'company_id,source_id,original_id'
            })
            .select();

        if (jobError) {
            logger.error('Supabase error storing job details:', { error: jobError, jobId, details });
            throw jobError;
        }

        logger.info(`Successfully stored job details for ${jobId}`);
        return jobData;
    } catch (error) {
        logger.error('Error in processJobDetails:', { error, jobId });
        throw error;
    }
  }

  async #processJob(jobId, details) {
    try {
      logger.info(`Processing job ${jobId}...`);
      
      // First get the company data
      const companyData = await this.#upsertToStagingCompany(details);
      
      // Extract capabilities and skills from the job description
      const aiAnalysis = await this.#extractCapabilitiesAndSkills(details.description, companyData);
      logger.info(`AI Analysis results for job ${jobId}:`, {
        capabilities: aiAnalysis.capabilities.length,
        skills: aiAnalysis.skills.length
      });
      
      // 1. First store the job details
      const jobData = await this.#processJobDetails(jobId, details, companyData);
      if (!jobData) {
        throw new Error('Failed to store job details');
      }
      logger.debug(`Job details stored for ${jobId}`);

      // 2. Create/update the role
      const roleData = {
        company_id: companyData[0].id,
        title: details.title,
        grade_band: details.salary,
        location: details.location,
        primary_purpose: details.description?.split('.')[0] || '',
        raw_data: {
          ...details,
          ai_analysis: aiAnalysis
        },
        sync_status: 'pending',
        last_synced_at: new Date().toISOString(),
        normalized_key: `${details.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${jobId}`
      };

      logger.debug('Attempting to store role data:', {
        jobId,
        roleData
      });

      // First check if the role exists
      const { data: existingRole, error: checkError } = await this.#supabase
        .from('roles')
        .select('*')
        .eq('company_id', companyData[0].id)
        .eq('normalized_key', roleData.normalized_key)
        .maybeSingle();

      if (checkError) {
        logger.error(`Error checking for existing role ${jobId}:`, {
          error: {
            message: checkError.message,
            details: checkError.details,
            hint: checkError.hint,
            code: checkError.code
          }
        });
        throw checkError;
      }

      // Then perform the upsert
      const { data: role, error: roleError } = await this.#supabase
        .from('roles')
        .upsert(roleData, {
          onConflict: 'company_id,normalized_key',
          returning: 'representation'
        });

      if (roleError) {
        logger.error(`Error storing role data for ${jobId}:`, {
          error: {
            message: roleError.message,
            details: roleError.details,
            hint: roleError.hint,
            code: roleError.code
          },
          roleData
        });
        throw roleError;
      }

      if (!role || !role[0]) {
        // If upsert didn't return data, try to fetch the role again
        const { data: fetchedRole, error: fetchError } = await this.#supabase
          .from('roles')
          .select('*')
          .eq('company_id', companyData[0].id)
          .eq('normalized_key', roleData.normalized_key)
          .maybeSingle();

        if (fetchError) {
          logger.error(`Error fetching role after upsert for ${jobId}:`, {
            error: {
              message: fetchError.message,
              details: fetchError.details,
              hint: fetchError.hint,
              code: fetchError.code
            }
          });
          throw fetchError;
        }

        if (!fetchedRole) {
          logger.error(`No role data found after upsert for ${jobId}:`, {
            roleData,
            existingRole,
            response: { role, error: roleError }
          });
          throw new Error('Failed to store role data - could not verify role creation');
        }

        logger.info(`Retrieved role data after upsert for ${jobId}`, {
          roleId: fetchedRole.id
        });

        // Link capabilities and skills to the role
        await this.#linkCapabilitiesAndSkills(fetchedRole.id, aiAnalysis);
        
        return { job: jobData, role: fetchedRole };
      }

      logger.info(`Successfully stored role data for ${jobId}`, {
        roleId: role[0].id
      });

      // Link capabilities and skills to the role
      await this.#linkCapabilitiesAndSkills(role[0].id, aiAnalysis);
      
      return { job: jobData, role: role[0] };
    } catch (error) {
      logger.error(`Error processing job ${jobId}:`, {
        error: {
          message: error.message,
          stack: error.stack
        },
        job: details
      });
      throw error;
    }
  }

  async #linkCapabilitiesAndSkills(roleId, aiAnalysis) {
    try {
      // Link capabilities
      if (aiAnalysis.capabilities?.length > 0) {
        for (const capability of aiAnalysis.capabilities) {
          const capabilityId = `cap_${capability.name.toLowerCase().replace(/\s+/g, '_')}`;
          await this.#upsertToStagingRoleCapability(roleId, capabilityId, 'core', capability.level);
        }
      }

      // Link skills
      if (aiAnalysis.skills?.length > 0) {
        for (const skill of aiAnalysis.skills) {
          const skillId = `skill_${skill.name.toLowerCase().replace(/\s+/g, '_')}`;
          await this.#upsertToStagingRoleSkill(roleId, skillId);
        }
      }
    } catch (error) {
      logger.error('Error linking capabilities and skills:', {
        error: {
          message: error.message,
          stack: error.stack,
          details: error
        },
        roleId,
        aiAnalysis
      });
    }
  }

  async #validateJobData(job) {
    try {
        // Check if validation failure already exists
        const { data: existingFailure, error: checkError } = await this.#supabase
            .from('validation_failures')
            .select('id')
            .eq('institution_id', this.#institutionId)
            .eq('source_id', job.source || 'nswgov')
            .eq('original_id', job.jobId)
            .single();

        if (checkError && checkError.code !== 'PGRST116') {
            logger.error('Error checking validation failure:', {
                error: {
                    message: checkError.message,
                    details: checkError.details,
                    hint: checkError.hint,
                    code: checkError.code
                }
            });
            return false;
        }

        if (existingFailure) {
            // Update existing validation failure
            const { error: updateError } = await this.#supabase
                .from('validation_failures')
                .update({
                    last_checked_at: new Date().toISOString(),
                    raw_data: job
                })
                .eq('id', existingFailure.id);

            if (updateError) {
                logger.error('Error updating validation failure:', {
                    error: {
                        message: updateError.message,
                        details: updateError.details,
                        hint: updateError.hint,
                        code: updateError.code
                    }
                });
            }
            return false;
        }

        // Insert new validation failure
        const { error: insertError } = await this.#supabase
            .from('validation_failures')
            .insert({
                institution_id: this.#institutionId,
                source_id: job.source || 'nswgov',
                original_id: job.jobId,
                last_checked_at: new Date().toISOString(),
                raw_data: job
            });

        if (insertError) {
            logger.error('Error inserting validation failure:', {
                error: {
                    message: insertError.message,
                    details: insertError.details,
                    hint: insertError.hint,
                    code: insertError.code
                }
            });
        }
        return false;
    } catch (error) {
        logger.error('Error in job validation:', {
            error: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : error,
            job
        });
        return false;
    }
  }
} 