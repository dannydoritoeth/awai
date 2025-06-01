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
import { createClient } from '@supabase/supabase-js';
import { generateRoleEmbedding, generateSkillEmbedding } from '../utils/embeddingTemplates.js';

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
  #currentRoleId = null;
  #frameworkCapabilities;

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

      // Migrate data from staging to live DB
      await this.#migrateToLiveDB();

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

  async #migrateToLiveDB() {
    try {
      logger.info('Starting migration from staging to live DB...');

      // Get the live DB client
      const liveSupabase = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_KEY || ''
      );

      // 1. Migrate companies first (since they're referenced by other entities)
      const { data: companies, error: companiesError } = await this.#supabase
        .from('companies')
        .select('*')
        .eq('sync_status', 'pending');

      if (companiesError) throw companiesError;

      if (companies && companies.length > 0) {
        const { error: liveCompaniesError } = await liveSupabase
          .from('companies')
          .upsert(
            companies.map(company => ({
              ...company,
              sync_status: 'synced',
              last_synced_at: new Date().toISOString()
            }))
          );

        if (liveCompaniesError) throw liveCompaniesError;

        // Update sync status in staging
        await this.#supabase
          .from('companies')
          .update({
            sync_status: 'synced',
            last_synced_at: new Date().toISOString()
          })
          .in('id', companies.map(c => c.id));

        logger.info(`Migrated ${companies.length} companies to live DB`);
      }

      // 2. Migrate capabilities (before role_capabilities)
      logger.info('Starting capabilities migration...');
      const { data: capabilities, error: capsError } = await this.#supabase
        .from('capabilities')
        .select('*')
        .eq('sync_status', 'pending');

      if (capsError) {
        logger.error('Error fetching capabilities from staging:', capsError);
        throw capsError;
      }

      logger.info(`Found ${capabilities?.length || 0} capabilities to migrate`);
      
      if (capabilities && capabilities.length > 0) {
        logger.info('Capabilities to migrate:', capabilities.map(c => ({ id: c.id, name: c.name })));
        
        const { data: liveCapsData, error: liveCapabilitiesError } = await liveSupabase
          .from('capabilities')
          .upsert(
            capabilities.map(cap => ({
              ...cap,
              sync_status: 'synced',
              last_synced_at: new Date().toISOString()
            }))
          )
          .select();

        if (liveCapabilitiesError) {
          logger.error('Error migrating capabilities:', {
            error: liveCapabilitiesError,
            capsToMigrate: capabilities
          });
          throw liveCapabilitiesError;
        }

        logger.info(`Successfully upserted ${liveCapsData?.length || 0} capabilities to live DB`);

        // Verify capabilities in live DB
        const { data: verifyLiveCaps, error: verifyError } = await liveSupabase
          .from('capabilities')
          .select('id, name')
          .in('id', capabilities.map(c => c.id));
        
        if (verifyError) {
          logger.error('Error verifying capabilities in live DB:', verifyError);
        } else {
          logger.info(`Verified ${verifyLiveCaps?.length || 0} capabilities in live DB:`, 
            verifyLiveCaps?.map(c => ({ id: c.id, name: c.name })));
        }

        // Update sync status in staging
        const { error: updateError } = await this.#supabase
          .from('capabilities')
          .update({
            sync_status: 'synced',
            last_synced_at: new Date().toISOString()
          })
          .in('id', capabilities.map(c => c.id));

        if (updateError) {
          logger.error('Error updating capabilities sync status in staging:', updateError);
        } else {
          logger.info(`Updated sync status for ${capabilities.length} capabilities in staging`);
        }

        logger.info(`Completed capabilities migration`);
      }

      // 3. Migrate skills (before role_skills)
      logger.info('Starting skills migration...');
      const { data: skills, error: skillsError } = await this.#supabase
        .from('skills')
        .select('*')
        .eq('sync_status', 'pending');

      if (skillsError) {
        logger.error('Error fetching skills from staging:', skillsError);
        throw skillsError;
      }

      logger.info(`Found ${skills?.length || 0} skills to migrate`);
      
      if (skills && skills.length > 0) {
        logger.info('Skills to migrate:', skills.map(s => ({ id: s.id, name: s.name })));
        
        const { data: liveSkillsData, error: liveSkillsError } = await liveSupabase
          .from('skills')
          .upsert(
            skills.map(skill => ({
              ...skill,
              sync_status: 'synced',
              last_synced_at: new Date().toISOString()
            }))
          )
          .select();

        if (liveSkillsError) {
          logger.error('Error migrating skills:', {
            error: liveSkillsError,
            skillsToMigrate: skills
          });
          throw liveSkillsError;
        }

        logger.info(`Successfully upserted ${liveSkillsData?.length || 0} skills to live DB`);

        // Verify skills in live DB
        const { data: verifyLiveSkills, error: verifyError } = await liveSupabase
          .from('skills')
          .select('id, name')
          .in('id', skills.map(s => s.id));
        
        if (verifyError) {
          logger.error('Error verifying skills in live DB:', verifyError);
        } else {
          logger.info(`Verified ${verifyLiveSkills?.length || 0} skills in live DB:`, 
            verifyLiveSkills?.map(s => ({ id: s.id, name: s.name })));
        }

        // Update sync status in staging
        const { error: updateError } = await this.#supabase
          .from('skills')
          .update({
            sync_status: 'synced',
            last_synced_at: new Date().toISOString()
          })
          .in('id', skills.map(s => s.id));

        if (updateError) {
          logger.error('Error updating skills sync status in staging:', updateError);
        } else {
          logger.info(`Updated sync status for ${skills.length} skills in staging`);
        }

        logger.info(`Completed skills migration`);
      }

      // 4. Migrate jobs
      const { data: jobs, error: jobsError } = await this.#supabase
        .from('jobs')
        .select('*')
        .eq('sync_status', 'pending');

      if (jobsError) throw jobsError;

      if (jobs && jobs.length > 0) {
        const { error: liveJobsError } = await liveSupabase
          .from('jobs')
          .upsert(
            jobs.map(job => ({
              ...job,
              sync_status: 'synced',
              last_synced_at: new Date().toISOString()
            }))
          );

        if (liveJobsError) {
          logger.error('Error migrating jobs:', {
            error: liveJobsError,
            jobsToMigrate: jobs
          });
          throw liveJobsError;
        }

        // Update sync status in staging
        await this.#supabase
          .from('jobs')
          .update({
            sync_status: 'synced',
            last_synced_at: new Date().toISOString()
          })
          .in('id', jobs.map(j => j.id));

        logger.info(`Migrated ${jobs.length} jobs to live DB`);
      }

      // 5. Migrate roles
      const { data: roles, error: rolesError } = await this.#supabase
        .from('roles')
        .select('*')
        .eq('sync_status', 'pending');

      if (rolesError) throw rolesError;

      if (roles && roles.length > 0) {
        const { error: liveRolesError } = await liveSupabase
          .from('roles')
          .upsert(
            roles.map(role => ({
              ...role,
              sync_status: 'synced',
              last_synced_at: new Date().toISOString()
            }))
          );

        if (liveRolesError) throw liveRolesError;

        // Update sync status in staging
        await this.#supabase
          .from('roles')
          .update({
            sync_status: 'synced',
            last_synced_at: new Date().toISOString()
          })
          .in('id', roles.map(r => r.id));

        logger.info(`Migrated ${roles.length} roles to live DB`);
      }

      // 6. Migrate role capabilities (after both roles and capabilities exist)
      const { data: roleCapabilities, error: roleCapsError } = await this.#supabase
        .from('role_capabilities')
        .select('*')
        .eq('sync_status', 'pending');

      if (roleCapsError) throw roleCapsError;

      if (roleCapabilities && roleCapabilities.length > 0) {
        const { error: liveRoleCapsError } = await liveSupabase
          .from('role_capabilities')
          .upsert(
            roleCapabilities.map(rc => ({
              ...rc,
              sync_status: 'synced',
              last_synced_at: new Date().toISOString()
            }))
          );

        if (liveRoleCapsError) {
          logger.error('Error migrating role capabilities:', {
            error: liveRoleCapsError,
            roleCapabilities
          });
          throw liveRoleCapsError;
        }

        // Update sync status in staging
        await this.#supabase
          .from('role_capabilities')
          .update({
            sync_status: 'synced',
            last_synced_at: new Date().toISOString()
          })
          .in('id', roleCapabilities.map(rc => rc.id));

        logger.info(`Migrated ${roleCapabilities.length} role capabilities to live DB`);
      }

      // 7. Migrate role skills (after both roles and skills exist)
      const { data: roleSkills, error: roleSkillsError } = await this.#supabase
        .from('role_skills')
        .select('*')
        .eq('sync_status', 'pending');

      if (roleSkillsError) throw roleSkillsError;

      if (roleSkills && roleSkills.length > 0) {
        const { error: liveRoleSkillsError } = await liveSupabase
          .from('role_skills')
          .upsert(
            roleSkills.map(rs => ({
              ...rs,
              sync_status: 'synced',
              last_synced_at: new Date().toISOString()
            }))
          );

        if (liveRoleSkillsError) {
          logger.error('Error migrating role skills:', {
            error: liveRoleSkillsError,
            roleSkills
          });
          throw liveRoleSkillsError;
        }

        // Update sync status in staging
        await this.#supabase
          .from('role_skills')
          .update({
            sync_status: 'synced',
            last_synced_at: new Date().toISOString()
          })
          .in('id', roleSkills.map(rs => rs.id));

        logger.info(`Migrated ${roleSkills.length} role skills to live DB`);
      }

      logger.info('Successfully completed migration from staging to live DB');

      // Add verification step
      await this.#verifyLiveSync(liveSupabase);
    } catch (error) {
      logger.error('Error migrating data to live DB:', {
        error: {
          message: error.message,
          stack: error.stack,
          details: error
        }
      });
      throw error;
    }
  }

  async #verifyLiveSync(liveSupabase) {
    try {
      logger.info('\n----------------------------------------');
      logger.info('Verifying Live DB Sync Status:');
      logger.info('----------------------------------------');

      // Get the timestamp from 5 minutes ago to check recent syncs
      const recentTimestamp = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      // Get all recently synced items from staging
      const [
        { data: stagingJobs },
        { data: stagingRoles },
        { data: stagingSkills },
        { data: stagingCapabilities },
        { data: stagingRoleSkills },
        { data: stagingRoleCapabilities }
      ] = await Promise.all([
        this.#supabase.from('jobs').select('id, original_id').gte('last_synced_at', recentTimestamp),
        this.#supabase.from('roles').select('id').gte('last_synced_at', recentTimestamp),
        this.#supabase.from('skills').select('id').gte('last_synced_at', recentTimestamp),
        this.#supabase.from('capabilities').select('id').gte('last_synced_at', recentTimestamp),
        this.#supabase.from('role_skills').select('role_id, skill_id').eq('sync_status', 'synced'),
        this.#supabase.from('role_capabilities').select('role_id, capability_id').eq('sync_status', 'synced')
      ]);

      // Log the current state of staging tables
      const [
        { count: totalJobs },
        { count: totalRoles },
        { count: totalSkills },
        { count: totalCapabilities },
        { count: totalRoleSkills },
        { count: totalRoleCapabilities }
      ] = await Promise.all([
        this.#supabase.from('jobs').select('*', { count: 'exact', head: true }),
        this.#supabase.from('roles').select('*', { count: 'exact', head: true }),
        this.#supabase.from('skills').select('*', { count: 'exact', head: true }),
        this.#supabase.from('capabilities').select('*', { count: 'exact', head: true }),
        this.#supabase.from('role_skills').select('*', { count: 'exact', head: true }),
        this.#supabase.from('role_capabilities').select('*', { count: 'exact', head: true })
      ]);

      logger.info('Current staging table counts:');
      logger.info(`Jobs total: ${totalJobs}, Synced in last 5m: ${stagingJobs?.length || 0}`);
      logger.info(`Roles total: ${totalRoles}, Synced in last 5m: ${stagingRoles?.length || 0}`);
      logger.info(`Skills total: ${totalSkills}, Synced in last 5m: ${stagingSkills?.length || 0}`);
      logger.info(`Capabilities total: ${totalCapabilities}, Synced in last 5m: ${stagingCapabilities?.length || 0}`);
      logger.info(`Role Skills total: ${totalRoleSkills}, Synced in last 5m: ${stagingRoleSkills?.length || 0}`);
      logger.info(`Role Capabilities total: ${totalRoleCapabilities}, Synced in last 5m: ${stagingRoleCapabilities?.length || 0}`);

      // Sample some records to check their sync_status
      const sampleChecks = await Promise.all([
        this.#supabase.from('jobs').select('id, sync_status, last_synced_at').limit(5),
        this.#supabase.from('roles').select('id, sync_status, last_synced_at').limit(5),
        this.#supabase.from('skills').select('id, sync_status, last_synced_at').limit(5),
        this.#supabase.from('capabilities').select('id, sync_status, last_synced_at').limit(5)
      ]);

      logger.info('\nSample records sync status:');
      ['Jobs', 'Roles', 'Skills', 'Capabilities'].forEach((entity, index) => {
        logger.info(`${entity} samples:`);
        sampleChecks[index].data?.forEach(record => {
          logger.info(`  - ID: ${record.id}, Status: ${record.sync_status}, Last Synced: ${record.last_synced_at}`);
        });
      });

      // Get corresponding items from live DB
      const [
        { data: liveJobs },
        { data: liveRoles },
        { data: liveSkills },
        { data: liveCapabilities },
        { data: liveRoleSkills },
        { data: liveRoleCapabilities }
      ] = await Promise.all([
        liveSupabase.from('jobs').select('id, original_id').in('original_id', stagingJobs?.map(j => j.original_id) || []),
        liveSupabase.from('roles').select('id').in('id', stagingRoles?.map(r => r.id) || []),
        liveSupabase.from('skills').select('id').in('id', stagingSkills?.map(s => s.id) || []),
        liveSupabase.from('capabilities').select('id').in('id', stagingCapabilities?.map(c => c.id) || []),
        liveSupabase.from('role_skills').select('role_id, skill_id').in('role_id', stagingRoleSkills?.map(rs => rs.role_id) || []),
        liveSupabase.from('role_capabilities').select('role_id, capability_id').in('role_id', stagingRoleCapabilities?.map(rc => rc.role_id) || [])
      ]);

      // Compare and log results
      const compareResults = (entityName, staging, live, idField = 'id') => {
        const stagingCount = staging?.length || 0;
        const liveCount = live?.length || 0;
        const stagingIds = new Set(staging?.map(item => item[idField]) || []);
        const liveIds = new Set(live?.map(item => item[idField]) || []);
        const missing = staging?.filter(item => !liveIds.has(item[idField])) || [];

        logger.info(`\n${entityName}:`);
        logger.info(`  - Recently synced in staging: ${stagingCount}`);
        logger.info(`  - Found in live DB: ${liveCount}`);
        logger.info(`  - Successfully synced: ${liveCount}/${stagingCount}`);
        
        if (missing.length > 0) {
          logger.warn(`  - Missing in live DB: ${missing.length} items`);
          logger.warn(`  - Missing IDs: ${JSON.stringify(missing.map(item => item[idField]))}`);
        }
      };

      compareResults('Jobs', stagingJobs, liveJobs, 'original_id');
      compareResults('Roles', stagingRoles, liveRoles);
      compareResults('Skills', stagingSkills, liveSkills);
      compareResults('Capabilities', stagingCapabilities, liveCapabilities);

      // For relationships, create composite keys for comparison
      const compareRelationships = (entityName, staging, live) => {
        const getKey = (item) => `${item.role_id}-${item.skill_id || item.capability_id}`;
        const stagingKeys = new Set(staging?.map(getKey) || []);
        const liveKeys = new Set(live?.map(getKey) || []);
        const missing = staging?.filter(item => !liveKeys.has(getKey(item))) || [];

        logger.info(`\n${entityName}:`);
        logger.info(`  - Recently synced in staging: ${staging?.length || 0}`);
        logger.info(`  - Found in live DB: ${live?.length || 0}`);
        logger.info(`  - Successfully synced: ${live?.length || 0}/${staging?.length || 0}`);
        
        if (missing.length > 0) {
          logger.warn(`  - Missing in live DB: ${missing.length} relationships`);
          logger.warn(`  - Missing relationships: ${JSON.stringify(missing)}`);
        }
      };

      compareRelationships('Role Skills', stagingRoleSkills, liveRoleSkills);
      compareRelationships('Role Capabilities', stagingRoleCapabilities, liveRoleCapabilities);

      logger.info('\n----------------------------------------');
    } catch (error) {
      logger.error('Error verifying live sync:', {
        error: {
          message: error.message,
          stack: error.stack,
          details: error
        }
      });
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
      logger.info('Extracted job details:', {
        jobId,
        title: jobDetails.title,
        department: jobDetails.department,
        descriptionLength: jobDetails.description?.length || 0,
        skillsFound: jobDetails.skills?.length || 0
      });
      
      // Add job ID and source URL
      jobDetails.jobId = jobId;
      jobDetails.sourceUrl = url;
      
      // Find and process documents
      const documents = await this.#findJobDocuments(jobId);
      if (documents && documents.length > 0) {
        jobDetails.documents = documents;
        logger.info(`Found ${documents.length} documents for job ${jobId}`);
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
   * Upserts a job to the staging jobs collection
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
   * Upserts a document to the staging documents collection
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

      // First check if company exists
      const { data: existingCompany, error: checkError } = await this.#supabase
        .from('companies')
        .select('id, name')
        .eq('name', companyName)
        .maybeSingle();

      if (checkError) {
        throw checkError;
      }

      if (existingCompany) {
        logger.info(`Company ${companyName} already exists with id ${existingCompany.id}`);
        return [existingCompany];
      }

      // If company doesn't exist, insert it
      const { data, error } = await this.#supabase
        .from('companies')
        .insert({
          name: companyName,
          description: company.description || `${companyName} - NSW Government`,
          website: company.website || 'https://www.nsw.gov.au',
          sync_status: 'pending',
          last_synced_at: new Date().toISOString(),
          raw_data: company
        })
        .select();

      if (error) throw error;
      logger.info(`Successfully inserted company: ${companyName}`);
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
      // First check if role exists
      const normalizedKey = this.#normalizeRoleTitle(role.title);
      const { data: existingRole, error: checkError } = await this.#supabase
        .from('roles')
        .select('id')
        .eq('company_id', role.company_id)
        .eq('normalized_key', normalizedKey)
        .maybeSingle();

      if (checkError) {
        logger.error('Error checking existing role:', { error: checkError, role: role.title });
        throw checkError;
      }


      let embedding = null;
      try {
        embedding = await generateRoleEmbedding(role, {
          job: role.raw_data,
          capabilities: role.raw_data?.capabilities || [],
          skills: role.raw_data?.skills || [],
          taxonomies: role.raw_data?.taxonomies || [],
          relatedJobs: role.raw_data?.related_jobs || []
        });
      } catch (embeddingError) {
        logger.error('Error generating role embedding:', { error: embeddingError, role: role.title });
      }


      let result;
      if (existingRole) {
        // Update existing role
        const { data, error: updateError } = await this.#supabase
          .from('roles')
          .update({
            title: role.title,
            division_id: role.division_id,
            grade_band: role.grade_band,
            location: role.location,
            anzsco_code: role.anzsco_code,
            pcat_code: role.pcat_code,
            primary_purpose: role.primary_purpose,
            raw_data: role.raw_data,
            sync_status: 'pending',
            normalized_key: normalizedKey,
            embedding: embedding
          })
          .eq('id', existingRole.id)
          .select();

        if (updateError) {
          logger.error('Error updating role:', { error: updateError, role: role.title });
          throw updateError;
        }
        result = data;
        logger.info(`Successfully updated role: ${role.title}`);
      } else {
        // Insert new role
        const { data, error: insertError } = await this.#supabase
          .from('roles')
          .insert({
            company_id: role.company_id,
            title: role.title,
            division_id: role.division_id,
            grade_band: role.grade_band,
            location: role.location,
            anzsco_code: role.anzsco_code,
            pcat_code: role.pcat_code,
            primary_purpose: role.primary_purpose,
            raw_data: role.raw_data,
            sync_status: 'pending',
            normalized_key: normalizedKey,
            embedding: embedding
          })
          .select();

        if (insertError) {
          logger.error('Error inserting role:', { error: insertError, role: role.title });
          throw insertError;
        }
        result = data;
        logger.info(`Successfully inserted role: ${role.title}`);
      }

      if (result && result[0]) {
        this.#currentRoleId = result[0].id;
        logger.info(`Role stored with ID: ${this.#currentRoleId}`);
      }

      return result;
    } catch (error) {
      logger.error('Error upserting role:', { error, role: role.title });
      throw error;
    }
  }

  /**
   * Normalizes a role title to create a consistent key
   * This helps match similar roles across different job postings
   * @param {string} title - The role title to normalize
   * @returns {string} - The normalized role key
   */
  #normalizeRoleTitle(title) {
    if (!title) return '';
    
    // Convert to lowercase
    let normalized = title.toLowerCase();
    
    // Remove common prefixes/suffixes
    const prefixesToRemove = [
      'senior', 'junior', 'lead', 'principal', 'head', 'chief',
      'graduate', 'entry level', 'experienced', 'temporary', 'permanent',
      'contract', 'casual', 'part time', 'full time'
    ];
    
    const suffixesToRemove = [
      'level 1', 'level 2', 'level 3', 'level 4', 'level 5',
      'grade 1', 'grade 2', 'grade 3', 'grade 4', 'grade 5',
      'i', 'ii', 'iii', 'iv', 'v'
    ];
    
    // Remove prefixes
    for (const prefix of prefixesToRemove) {
      if (normalized.startsWith(prefix + ' ')) {
        normalized = normalized.substring(prefix.length).trim();
      }
    }
    
    // Remove suffixes
    for (const suffix of suffixesToRemove) {
      if (normalized.endsWith(' ' + suffix)) {
        normalized = normalized.substring(0, normalized.length - suffix.length).trim();
      }
    }
    
    // Remove special characters and extra spaces
    normalized = normalized
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '_')        // Replace spaces with underscores
      .replace(/_+/g, '_')         // Replace multiple underscores with single
      .replace(/^_+|_+$/g, '');    // Remove leading/trailing underscores
    
    return normalized;
  }

  async #upsertToStagingCapability(capability) {
    try {
      // First, check if capability exists
      const { data: existingCapability, error: checkError } = await this.#supabase
        .from('capabilities')
        .select('id')
        .eq('name', capability.name)
        .maybeSingle();

      if (checkError) {
        logger.error('Error checking existing capability:', { error: checkError, capability: capability.name });
        throw checkError;
      }

      // Prepare capability data
      const capabilityData = {
        name: capability.name,
        group_name: capability.group_name,
        description: capability.description,
        source_framework: 'NSW Public Sector Capability Framework',
        is_occupation_specific: false,
        normalized_key: this.#normalizeRoleTitle(capability.name),
        sync_status: 'pending',
        last_synced_at: null
      };

      let capabilityResult;
      if (existingCapability) {
        // Update existing capability
        const { data, error: updateError } = await this.#supabase
          .from('capabilities')
          .update(capabilityData)
          .eq('id', existingCapability.id)
          .select();

        if (updateError) {
          logger.error('Error updating capability:', { error: updateError, capability: capability.name });
          throw updateError;
        }
        capabilityResult = data;
        logger.info(`Successfully updated capability: ${capability.name}`);
      } else {
        // Insert new capability
        const { data, error: insertError } = await this.#supabase
          .from('capabilities')
          .insert(capabilityData)
          .select();

        if (insertError) {
          logger.error('Error inserting capability:', { error: insertError, capability: capability.name });
          throw insertError;
        }
        capabilityResult = data;
        logger.info(`Successfully inserted capability: ${capability.name}`);
      }

      if (!capabilityResult || capabilityResult.length === 0) {
        logger.error('Error storing capability:', { capability: capability.name, error: 'No data returned' });
        throw new Error('No data returned from capability upsert');
      }

      // Then, upsert the capability level
      const { data: levelData, error: levelError } = await this.#supabase
        .from('capability_levels')
        .upsert({
          capability_id: capabilityResult[0].id,
          level: capability.level,
          summary: capability.description,
          behavioral_indicators: capability.behavioral_indicators || []
        }, {
          onConflict: 'capability_id,level',
          returning: true
        });

      if (levelError) {
        logger.error('Error updating capability level:', { error: levelError, capability: capability.name });
        throw levelError;
      }

      return capabilityResult;
    } catch (error) {
      logger.error('Error storing capability:', { capability: capability.name, error: { message: error.message, details: error } });
      throw error;
    }
  }

  async #upsertToStagingSkill(skill, companyData) {
    try {
      // First check if skill exists
      const { data: existingSkill, error: checkError } = await this.#supabase
        .from('skills')
        .select('id')
        .eq('name', skill.name)
        .eq('company_id', companyData[0].id)
        .maybeSingle();

      if (checkError) {
        logger.error('Error checking existing skill:', {
          error: checkError,
          skill: skill.name
        });
        throw checkError;
      }


      // Generate embedding for the skill
      let embedding = null;
      try {
        embedding = await generateSkillEmbedding(skill, {
          relatedRoles: [{
            title: this.#currentRoleId ? 'Current Role' : undefined,
            context: skill.description
          }]
        });
      } catch (embeddingError) {
        logger.error('Error generating skill embedding:', { error: embeddingError, skill: skill.name });
      }

      const skillData = {
          name: skill.name,
        description: skill.description || '',
        source: 'job_description',
        is_occupation_specific: true,
        company_id: companyData[0].id,
        category: skill.category || 'Technical',
        sync_status: 'pending',
        last_synced_at: null,
        embedding: embedding
      };

      let result;
      if (existingSkill) {
        // Update existing skill
        const { data, error: updateError } = await this.#supabase
          .from('skills')
          .update(skillData)
          .eq('id', existingSkill.id)
          .select();

        if (updateError) {
          logger.error('Error updating skill:', {
            error: updateError,
            skill: skill.name
          });
          throw updateError;
        }
        result = data;
        logger.info(`Successfully updated skill: ${skill.name}`);
      } else {
        // Insert new skill
        const { data, error: insertError } = await this.#supabase
          .from('skills')
          .insert(skillData)
          .select();

        if (insertError) {
          logger.error('Error inserting skill:', {
            error: insertError,
            skill: skill.name
          });
          throw insertError;
        }
        result = data;
        logger.info(`Successfully inserted skill: ${skill.name}`);
      }

      return result;
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
          name: taxonomy.name,
          description: taxonomy.description,
          taxonomy_type: taxonomy.taxonomy_type,
          raw_data: taxonomy,
          processing_status: 'pending'
        }, {
          onConflict: 'name',
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
          processing_status: 'pending'
        }, {
          onConflict: 'job_id,document_id',
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
          processing_status: 'pending'
        }, {
          onConflict: 'role_id,document_id',
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

  async #upsertToStagingRoleCapability(roleId, capabilityId, capabilityType, level) {
    try {
      if (!roleId || !capabilityId) {
        throw new Error('Role ID and Capability ID are required');
      }

      logger.debug('Linking role capability:', {
        roleId,
        capabilityId,
        capabilityType,
        level
      });

      const { data, error } = await this.#supabase
        .from('role_capabilities')
        .upsert({
          role_id: roleId,
          capability_id: capabilityId,
          capability_type: capabilityType,
          level: level,
          sync_status: 'pending',
          last_synced_at: null
        }, {
          onConflict: 'role_id,capability_id'
        })
        .select();

      if (error) {
        logger.error('Error upserting role capability:', {
          error,
          roleId,
          capabilityId
        });
        throw error;
      }

      logger.info(`Successfully linked capability ${capabilityId} to role ${roleId}`);
      return data;
    } catch (error) {
      logger.error('Error upserting role capability:', {
        roleId,
        capabilityId,
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
      if (!roleId || !skillId) {
        throw new Error('Role ID and Skill ID are required');
      }

      const { data, error } = await this.#supabase
        .from('role_skills')
        .upsert({
          role_id: roleId,
          skill_id: skillId,
          sync_status: 'pending',
          last_synced_at: null
        }, {
          onConflict: 'role_id,skill_id',
          returning: true
        });

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error upserting role skill:', { roleId, skillId, error });
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
          sync_status: 'pending'
        }, {
          onConflict: 'role_id,taxonomy_id',
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
          capability_id: level.capability_id,
          level: level.level,
          summary: level.summary,
          behavioral_indicators: level.behavioral_indicators,
          processing_status: 'pending'
        }, {
          onConflict: 'capability_id,level',
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
      const { data: companiesData, error: companiesError } = await this.#supabase
        .from('companies')
        .select('id', { count: 'exact' });
      
      const companiesCount = companiesData?.length || 0;
      logger.info(`✓ Companies: ${companiesCount} records processed to staging`);

      // 2. Roles
      const { data: rolesData, error: rolesError } = await this.#supabase
        .from('roles')
        .select('id', { count: 'exact' });
      
      const rolesCount = rolesData?.length || 0;
      logger.info(`✓ Roles: ${rolesCount} records processed to staging`);

      // 3. Jobs
      const { data: jobsData, error: jobsError } = await this.#supabase
        .from('jobs')
        .select('id', { count: 'exact' });
      
      const jobsCount = jobsData?.length || 0;
      logger.info(`✓ Jobs: ${jobsCount} records processed to staging`);

      // 4. Capabilities
      const { data: capabilitiesData, error: capabilitiesError } = await this.#supabase
        .from('capabilities')
        .select('id', { count: 'exact' });
      
      const capabilitiesCount = capabilitiesData?.length || 0;
      logger.info(`✓ Capabilities: ${capabilitiesCount} records processed to staging`);

      // 5. Skills
      const { data: skillsData, error: skillsError } = await this.#supabase
        .from('skills')
        .select('id', { count: 'exact' });
      
      const skillsCount = skillsData?.length || 0;
      logger.info(`✓ Skills: ${skillsCount} records processed to staging`);

      // 6. Role Capabilities
      const { data: roleCapabilitiesData, error: roleCapabilitiesError } = await this.#supabase
        .from('role_capabilities')
        .select('role_id,capability_id', { count: 'exact' });
      
      const roleCapabilitiesCount = roleCapabilitiesData?.length || 0;
      logger.info(`✓ Role Capabilities: ${roleCapabilitiesCount} records processed to staging`);

      // 7. Role Skills
      const { data: roleSkillsData, error: roleSkillsError } = await this.#supabase
        .from('role_skills')
        .select('role_id,skill_id', { count: 'exact' });
      
      const roleSkillsCount = roleSkillsData?.length || 0;
      logger.info(`✓ Role Skills: ${roleSkillsCount} records processed to staging`);

      logger.info('----------------------------------------');
      logger.info('Total Records by Type:');
      logger.info('----------------------------------------');
      logger.info(`Companies: ${companiesCount}`);
      logger.info(`Roles: ${rolesCount}`);
      logger.info(`Jobs: ${jobsCount}`);
      logger.info(`Capabilities: ${capabilitiesCount}`);
      logger.info(`Skills: ${skillsCount}`);
      logger.info(`Role Capabilities: ${roleCapabilitiesCount}`);
      logger.info(`Role Skills: ${roleSkillsCount}`);
      logger.info('----------------------------------------');

      // Log any errors that occurred
      const errors = [
        companiesError, rolesError, jobsError, capabilitiesError,
        skillsError, roleCapabilitiesError, roleSkillsError
      ].filter(Boolean);

      if (errors.length > 0) {
        logger.error('Errors occurred while getting stats:', errors);
      }

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
      // Load capabilities from JSON file
      const capabilitiesPath = path.join(process.cwd(), 'database', 'seed', 'capabilities.json');
      const capabilitiesData = JSON.parse(fs.readFileSync(capabilitiesPath, 'utf8'));
      
      logger.info(`Found ${capabilitiesData.length} capabilities in framework definition`);

      // Upsert each capability
      for (const capability of capabilitiesData) {
        const { data, error } = await this.#supabase
          .from('capabilities')
          .upsert({
            id: capability.id,
            name: capability.name,
            group_name: capability.group_name,
            description: capability.description,
            source_framework: capability.source_framework,
            is_occupation_specific: capability.is_occupation_specific,
            sync_status: 'pending',
            last_synced_at: null
          }, {
            onConflict: 'id'
          })
          .select();

        if (error) {
          logger.error('Error upserting capability:', {
            capability: capability.name,
            error
          });
          throw error;
        }

        logger.info(`Initialized capability: ${capability.name}`);
      }

      // Store capabilities in memory for use in prompts
      this.#frameworkCapabilities = capabilitiesData;
      
      logger.info('Successfully initialized NSW Capability Framework');
    } catch (error) {
      logger.error('Error initializing NSW Capability Framework:', {
        error: {
          message: error.message,
          stack: error.stack,
          details: error
        }
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
        const analysis = await this.#extractCapabilitiesAndSkills(content, null);
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

  async #extractCapabilitiesAndSkills(jobDescription, companyData) {
    try {
      logger.info('Starting AI analysis of job description...');
      const aiResults = await this.#analyzeJobDescription(jobDescription);
      logger.info('Received AI analysis response');
      logger.info('AI analysis results:', {
        capabilitiesFound: aiResults.capabilities.length,
        skillsFound: aiResults.skills.length
      });

      if (!this.#currentRoleId) {
        logger.warn('No current role ID set, skipping capability and skill linking');
        return aiResults;
      }

      // Process capabilities
      logger.info(`Processing ${aiResults.capabilities.length} capabilities...`);
      for (const capability of aiResults.capabilities) {
        try {
          logger.debug('Upserting capability:', { capability: capability.name });
          const capabilityResult = await this.#upsertToStagingCapability(capability);
          
          if (capabilityResult && capabilityResult[0]) {
            // Link capability to role
            await this.#upsertToStagingRoleCapability(
              this.#currentRoleId, 
              capabilityResult[0].id, 
              'core', // capability type
              capability.level // capability level
            );
          }
        } catch (error) {
          logger.error('Error processing capability:', { error, capability });
        }
      }

      // Process skills
      logger.info(`Processing ${aiResults.skills.length} skills...`);
      for (const skill of aiResults.skills) {
        try {
          logger.debug('Upserting skill:', { skill: skill.name });
          const skillResult = await this.#upsertToStagingSkill(skill, companyData);
          
          if (skillResult && skillResult[0]) {
            // Link skill to role
            await this.#upsertToStagingRoleSkill(this.#currentRoleId, skillResult[0].id);
          }
        } catch (error) {
          logger.error('Error processing skill:', { error, skill });
        }
      }

      return aiResults;
    } catch (error) {
      logger.error('Error extracting capabilities and skills:', { error });
      throw error;
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
        // First check if job exists
        const { data: existingJob, error: checkError } = await this.#supabase
            .from('jobs')
            .select('id')
            .eq('company_id', companyData[0].id)
          .eq('source_id', 'nswgov')
          .eq('original_id', jobId)
          .maybeSingle();

        if (checkError) {
            throw checkError;
        }

        const jobData = {
            company_id: companyData[0].id,
            external_id: jobId,
            title: details.title,
            department: details.department,
            job_type: details.jobType,
            source_url: details.sourceUrl,
            remuneration: details.salary,
            close_date: details.closingDate ? new Date(details.closingDate) : null,
            locations: [details.location],
            sync_status: 'pending',
            last_synced_at: new Date().toISOString(),
            raw_data: details,
            source_id: 'nswgov',
            original_id: jobId
        };

        let result;
        if (existingJob) {
            // Update existing job
            const { data, error: updateError } = await this.#supabase
                .from('jobs')
                .update(jobData)
                .eq('id', existingJob.id)
                .select();

            if (updateError) throw updateError;
            result = data;
            logger.info(`Successfully updated job ${jobId}`);
        } else {
            // Insert new job
            const { data, error: insertError } = await this.#supabase
                .from('jobs')
                .insert(jobData)
                .select();

            if (insertError) throw insertError;
            result = data;
            logger.info(`Successfully inserted job ${jobId}`);
        }

        return result;
    } catch (error) {
        logger.error('Error in processJobDetails:', { error, jobId });
      throw error;
    }
  }

  async #processJob(jobId, details) {
    try {
      logger.info(`Processing job ${jobId}...`);
      
      // Get the live DB client
      const liveSupabase = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_KEY || ''
      );

      // Check if job already exists in live DB
      const { data: existingLiveJob, error: checkError } = await liveSupabase
        .from('jobs')
        .select('id')
        .eq('source_id', 'nswgov')
        .eq('original_id', jobId)
        .maybeSingle();

      if (checkError) {
        logger.error('Error checking live DB for existing job:', {
          error: checkError,
          jobId
        });
        throw checkError;
      }

      if (existingLiveJob) {
        logger.info(`Job ${jobId} already exists in live DB, skipping processing`);
        return null;
      }

      logger.info(`Job ${jobId} not found in live DB, proceeding with processing`);
      
      // First get the company data
      const companyData = await this.#upsertToStagingCompany(details);
      
      // 1. First store the job details
      const jobData = await this.#processJobDetails(jobId, details, companyData);
      if (!jobData) {
        throw new Error('Failed to store job details');
      }
      logger.debug(`Job details stored for ${jobId}`);

      // Get the job description from the nested structure
      const jobDescription = details.details?.description;

      // 2. Create/update the role
      const roleData = {
        company_id: companyData[0].id,
        title: details.title,
        grade_band: details.salary,
        location: details.location,
        primary_purpose: jobDescription ? jobDescription.split('.')[0] : '',
        source_id: 'nswgov',
        external_id: jobId,
        raw_data: {
          ...details,
          company: companyData[0]
        }
      };
      
      const role = await this.#upsertToStagingRole(roleData);
      if (!role || !role[0]) {
        logger.warn(`No role data returned for ${jobId}, but continuing processing`);
      } else {
        this.#currentRoleId = role[0].id;
        logger.info(`Role stored with ID: ${this.#currentRoleId}`);
      }
      
      // 3. Extract capabilities and skills using AI
      if (jobDescription) {
        logger.info(`Analyzing job description for ${jobId} (${jobDescription.length} characters)`);
        const aiResults = await this.#extractCapabilitiesAndSkills(jobDescription, companyData);
        if (aiResults) {
          jobData[0].raw_data = {
            ...jobData[0].raw_data,
            capabilities: aiResults.capabilities,
            skills: aiResults.skills
          };
        }
      }

      // Add the processed role to the list for taxonomy processing
      if (role && role[0]) {
        this.#processedRoles.push({
          id: role[0].id,
          title: details.title,
          department: details.department,
          role: details.details?.role
        });
      }

      return jobData;
    } catch (error) {
      logger.error('Error processing job:', {
        error: {
          message: error.message,
          stack: error.stack,
          details: error
        },
        job: jobId
      });
      throw error;
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

  set currentRoleId(id) {
    this.#currentRoleId = id;
  }

  get currentRoleId() {
    return this.#currentRoleId;
  }

  async #analyzeJobDescription(content) {
    try {
      logger.debug('Content length for analysis:', { length: content?.length || 0 });
      
      // Generate the capabilities list for the prompt
      const capabilitiesByGroup = {};
      this.#frameworkCapabilities.forEach(cap => {
        if (!capabilitiesByGroup[cap.group_name]) {
          capabilitiesByGroup[cap.group_name] = [];
        }
        capabilitiesByGroup[cap.group_name].push(`${cap.name}: ${cap.description}`);
      });

      // Build the capabilities section of the prompt
      let capabilitiesPrompt = 'NSW Government Capability Framework core capabilities:\n\n';
      for (const [group, capabilities] of Object.entries(capabilitiesByGroup)) {
        capabilitiesPrompt += `${group}:\n${capabilities.map(c => `- ${c}`).join('\n')}\n\n`;
      }
      
      const response = await this.#openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: `You are an expert in analyzing job descriptions and extracting capabilities based on the NSW Government Capability Framework. Your task is to:

1. ONLY extract capabilities from this predefined list of capabilities. Each capability includes its description to help you accurately match job requirements:

${capabilitiesPrompt}
2. For each capability you identify, determine the level (Foundational, Intermediate, Adept, Advanced, Highly Advanced) based on the role requirements and responsibilities.

3. Extract technical and soft skills mentioned in the job description, including:
- Technical skills (e.g. programming languages, tools, platforms)
- Domain knowledge (e.g. industry-specific knowledge)
- Soft skills (e.g. communication, teamwork)

Format your response as a JSON object with:
{
  "capabilities": [
    {
      "name": "string (MUST be one of the exact capability names listed above)",
      "level": "string (Foundational, Intermediate, Adept, Advanced, or Highly Advanced)",
      "description": "string (how this capability applies to the role)",
      "behavioral_indicators": ["string (specific behaviors that demonstrate this capability)"]
    }
  ],
  "skills": [
    {
      "name": "string (specific skill name)",
      "description": "string (context of how the skill is used)",
      "category": "string (Technical, Domain Knowledge, or Soft Skills)"
    }
  ]
}`
          },
          {
            role: "user",
            content: `Extract capabilities and skills from this job description. Focus on the key responsibilities and requirements. ONLY use capabilities from the predefined NSW Government Capability Framework list above:\n\n${content}`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      });

      const result = response.choices[0].message.content;
      if (!result) {
        throw new Error('No content returned from OpenAI');
      }
      
      try {
        const parsed = JSON.parse(result);
        return {
          capabilities: parsed.capabilities || [],
          skills: parsed.skills || []
        };
      } catch (parseError) {
        logger.error('Error parsing OpenAI response:', {
          error: parseError,
          response: result
        });
        return { capabilities: [], skills: [] };
      }
    } catch (error) {
      logger.error('Error calling OpenAI:', {
        error: {
          message: error.message,
          stack: error.stack,
          details: error
        }
      });
      return { capabilities: [], skills: [] };
    }
  }
} 
