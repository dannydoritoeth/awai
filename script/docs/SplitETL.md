# Split ETL Process Plan

## Overview

Currently, the ETL pipeline runs as a single process that handles both data ingestion (scraping) and AI-driven enrichment (processing). This document outlines a plan to split these into separate processes while maintaining the existing functionality.

## Current Architecture

The current pipeline follows this sequence:
1. Scrape job listings and details
2. Process jobs to extract capabilities, skills, etc.
3. Store processed jobs in the database

## Proposed Changes

### 1. Pipeline Options Enhancement

Add new options to `PipelineOptions` interface:

```typescript
interface PipelineOptions {
  // ... existing options ...
  pipelineMode?: 'scrapeOnly' | 'processOnly' | 'all';
}
```

### 2. Implementation Changes

#### OrchestratorService Modifications

1. Update `runPipeline` method to handle different modes:
   ```typescript
   async runPipeline(options?: PipelineOptions): Promise<PipelineResult> {
     await this.initializePipeline(options);
     
     const mode = options?.pipelineMode || 'all';
     
     switch (mode) {
       case 'scrapeOnly':
         return await this.runScrapeOnlyPipeline(options);
       case 'processOnly':
         return await this.runProcessOnlyPipeline(options);
       case 'all':
         return await this.runFullPipeline(options);
     }
   }
   ```

2. Add new pipeline mode methods:
   - `runScrapeOnlyPipeline`: Handles job scraping and storage
   - `runProcessOnlyPipeline`: Handles processing of previously scraped jobs
   - `runFullPipeline`: Maintains existing full pipeline functionality

#### Database Schema Updates

1. Add status flags to jobs table:
   - `is_scraped`: Boolean indicating if job data is ingested
   - `is_processed`: Boolean indicating if job has been enriched
   - `scrape_date`: Timestamp of ingestion
   - `process_date`: Timestamp of enrichment

### 3. Process Flow

#### Scrape Only Mode
1. Scrape job listings and details
2. Store raw job data in database
3. Mark jobs as `is_scraped = true`
4. Set `scrape_date` timestamp

#### Process Only Mode
1. Query unprocessed jobs (`is_scraped = true AND is_processed = false`)
2. Process jobs for AI enrichment
3. Update jobs with processed data
4. Mark jobs as `is_processed = true`
5. Set `process_date` timestamp

#### Full Pipeline Mode
1. Run scrape process
2. Immediately run process on scraped jobs
3. Update all status flags and timestamps

## Implementation Steps

1. Update TypeScript interfaces and types
2. Modify OrchestratorService implementation
3. Update database schema
4. Add new pipeline mode methods
5. Update metrics tracking for split processes
6. Add new tests for separate modes
7. Update documentation

## Benefits

- Allows for independent scaling of scraping and processing
- Enables retry mechanisms for failed processing
- Better resource utilization
- Improved monitoring and metrics per process
- Flexibility to run processes on different schedules

## Considerations

- Maintain backward compatibility
- Ensure data consistency between processes
- Handle edge cases (failed jobs, retries)
- Update monitoring and logging
- Consider rate limiting and API quotas separately

## Next Steps

1. Review and approve design
2. Create implementation tasks
3. Implement changes incrementally
4. Test thoroughly
5. Deploy and monitor

## Migration Plan

1. Add new fields to database (nullable initially)
2. Deploy code changes with feature flag
3. Run parallel testing
4. Gradually transition to split processes
5. Monitor and adjust as needed
