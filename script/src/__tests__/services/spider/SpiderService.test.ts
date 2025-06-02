/**
 * @file SpiderService.test.ts
 * @description Tests for the spider service
 */

import { SpiderService } from '../../../services/spider/SpiderService.js';
import { SpiderConfig, JobListing } from '../../../services/spider/types.js';
import { ConsoleLogger } from '../../../utils/logger.js';

// Mock Puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setUserAgent: jest.fn(),
      setViewport: jest.fn(),
      goto: jest.fn(),
      evaluate: jest.fn(),
      close: jest.fn()
    }),
    close: jest.fn()
  })
}));

describe('SpiderService', () => {
  let service: SpiderService;
  let logger: ConsoleLogger;
  
  const config: SpiderConfig = {
    baseUrl: 'https://test.jobs.nsw.gov.au',
    maxConcurrency: 2,
    retryAttempts: 3,
    retryDelay: 1000,
    userAgent: 'Mozilla/5.0 Test Agent'
  };

  const mockJobListing: JobListing = {
    id: '123',
    title: 'Test Job',
    agency: 'Test Agency',
    location: 'Sydney',
    salary: '$100,000',
    closingDate: '2024-03-01',
    url: 'https://test.jobs.nsw.gov.au/job/123',
    jobReference: 'REF123',
    postedDate: '2024-02-01'
  };

  beforeEach(() => {
    logger = new ConsoleLogger('test');
    service = new SpiderService(config, logger);
  });

  afterEach(async () => {
    await service.cleanup();
  });

  describe('getJobListings', () => {
    it('should scrape job listings successfully', async () => {
      const mockListings = [mockJobListing];
      const puppeteer = require('puppeteer');
      const mockPage = await puppeteer.launch().then((browser: any) => browser.newPage());
      
      mockPage.evaluate.mockResolvedValueOnce(mockListings);

      const listings = await service.getJobListings();
      
      expect(listings).toEqual(mockListings);
      expect(mockPage.goto).toHaveBeenCalledWith(config.baseUrl, { waitUntil: 'networkidle0' });
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should handle errors when scraping listings', async () => {
      const mockError = new Error('Network error');
      const puppeteer = require('puppeteer');
      const mockPage = await puppeteer.launch().then((browser: any) => browser.newPage());
      
      mockPage.goto.mockRejectedValueOnce(mockError);
      jest.spyOn(logger, 'error');

      await expect(service.getJobListings()).rejects.toThrow('Network error');
      expect(logger.error).toHaveBeenCalledWith('Error scraping job listings:', mockError);
    });
  });

  describe('getJobDetails', () => {
    it('should scrape job details successfully', async () => {
      const mockDetails = {
        ...mockJobListing,
        description: 'Test description',
        responsibilities: ['Resp 1'],
        requirements: ['Req 1'],
        notes: ['Note 1'],
        aboutUs: 'About us',
        contactDetails: {
          name: 'Test Contact',
          phone: '1234567890',
          email: 'test@test.com'
        }
      };

      const puppeteer = require('puppeteer');
      const mockPage = await puppeteer.launch().then((browser: any) => browser.newPage());
      
      mockPage.evaluate.mockResolvedValueOnce(mockDetails);

      const details = await service.getJobDetails(mockJobListing);
      
      expect(details).toEqual(mockDetails);
      expect(mockPage.goto).toHaveBeenCalledWith(mockJobListing.url, { waitUntil: 'networkidle0' });
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should handle errors when scraping details', async () => {
      const mockError = new Error('Page error');
      const puppeteer = require('puppeteer');
      const mockPage = await puppeteer.launch().then((browser: any) => browser.newPage());
      
      mockPage.goto.mockRejectedValueOnce(mockError);
      jest.spyOn(logger, 'error');

      await expect(service.getJobDetails(mockJobListing)).rejects.toThrow('Page error');
      expect(logger.error).toHaveBeenCalledWith(
        `Error scraping job details for ${mockJobListing.title}:`,
        mockError
      );
    });
  });

  describe('getMetrics', () => {
    it('should return current metrics', async () => {
      const metrics = service.getMetrics();
      
      expect(metrics).toMatchObject({
        totalJobs: 0,
        successfulScrapes: 0,
        failedScrapes: 0,
        startTime: expect.any(Date),
        endTime: expect.any(Date),
        errors: []
      });
    });
  });
}); 