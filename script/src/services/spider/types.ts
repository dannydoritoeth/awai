/**
 * @file types.ts
 * @description Part of NSW Government Jobs ETL Refactoring
 * 
 * Types and interfaces for the job spider service.
 * These types maintain consistency with the current implementation
 * while providing better type safety and documentation.
 * 
 * @module services/spider
 * @see RefactorETL.md for the complete refactoring plan
 * 
 * @author AWAI Team
 * @version 1.0.0
 * @since 2024-02-06
 */

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
  jobUrl?: string; // Same as url
  jobId?: string;  // Same as id
}

export interface JobDocument {
  title: string;
  url: string;
  type: string;
  content?: string;
}

export interface JobDetails extends JobListing {
  description: string;
  responsibilities: string[];
  requirements: string[];
  notes: string[];
  aboutUs: string;
  contactDetails: {
    name: string;
    phone: string;
    email: string;
  };
  documents: JobDocument[];
  error?: any;
}

export interface SpiderConfig {
  baseUrl: string;
  maxConcurrency: number;
  retryAttempts: number;
  retryDelay: number;
  userAgent: string;
  pageSize?: number; // Optional page size configuration
}

export interface SpiderMetrics {
  totalJobs: number;
  successfulScrapes: number;
  failedScrapes: number;
  startTime: Date;
  endTime?: Date;
  errors: {
    timestamp: Date;
    error: string;
    url: string;
  }[];
}

export interface ISpiderService {
  getJobListings(maxRecords?: number): Promise<JobListing[]>;
  getJobDetails(listing: JobListing): Promise<JobDetails>;
  getMetrics(): SpiderMetrics;
  cleanup(): Promise<void>;
} 