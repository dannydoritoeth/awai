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
  location: string | string[];
  salary: string;
  closingDate: string;
  url: string;
  jobReference: string;
  postedDate: string;
  jobType?: string;
}

export interface JobDocument {
  url: string | { url: string; title?: string; type?: string };
  title?: string;
  type?: string;
}

export interface JobDetails extends JobListing {
  description: string;
  responsibilities: string[];
  requirements: string[];
  notes: string[];
  aboutUs: string;
  jobType: string;
  contactDetails: {
    name: string;
    phone: string;
    email: string;
  };
  documents: JobDocument[];
  metadata?: {
    processedAt?: string;
    source?: string;
    version?: string;
  };
  embedding?: number[]; // Vector embedding for similarity matching
  classification?: string; // Classification level of the role
  roleId?: string; // ID of the role in the roles table
}

export interface SpiderConfig {
  baseUrl: string;
  maxConcurrency: number;
  retryAttempts: number;
  retryDelay: number;
  userAgent: string;
}

export interface SpiderMetrics {
  totalJobs: number;
  successfulScrapes: number;
  failedScrapes: number;
  startTime: Date;
  endTime?: Date;
  errors: {
    url: string;
    error: string;
    timestamp: Date;
  }[];
}

export interface ISpiderService {
  getJobListings(maxRecords?: number): Promise<JobListing[]>;
  getJobDetails(jobListing: JobListing): Promise<JobDetails>;
  getMetrics(): SpiderMetrics;
  cleanup(): Promise<void>;
} 