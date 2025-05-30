## Continuous ETL Pipeline for AI Talent Management

### Objective

Transform the batch-based job ingestion system into a real-time, continuous pipeline that processes jobs daily, maintains data integrity, and scales across multiple data sources and institutions.

### Key Requirements

* **Continuous Processing**: Daily updates instead of batch processing
* **Multi-Institution Support**: Handle multiple institutions (e.g., NSW Gov, VIC Gov, private sector groups)
* **Deduplication**: Prevent duplicate entries across multiple runs and sources
* **Change Tracking**: Monitor and record job updates over time
* **Job Lifecycle**: Handle job expiry and archival automatically

---

### 1. **Staging Schema**

```sql
-- Raw document storage
CREATE TABLE staging_documents (
  id SERIAL PRIMARY KEY,
  institution_id UUID NOT NULL,  -- Link to institution (e.g., NSW Gov)
  source_id TEXT NOT NULL,       -- e.g., 'seek', 'nswgov'
  external_id TEXT NOT NULL,     -- Original ID from source
  raw_content JSONB NOT NULL,    -- Raw scraped data
  scraped_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP,
  processing_status TEXT DEFAULT 'pending',
  error_details TEXT,
  metadata JSONB,
  UNIQUE(institution_id, source_id, external_id)
);

-- Failed processing tracking
CREATE TABLE staging_failed_documents (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES staging_documents(id),
  failure_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  error_type TEXT NOT NULL,
  error_details TEXT,
  retry_count INTEGER DEFAULT 0
);

-- Temporary job data during processing
CREATE TABLE staging_jobs (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES staging_documents(id),
  institution_id UUID NOT NULL,
  company_id UUID,              -- Optional, for private sector
  division_id UUID,             -- Optional, for structured orgs
  source_id TEXT NOT NULL,      -- e.g., 'seek', 'nswgov'
  original_id TEXT NOT NULL,    -- ID from the source system
  external_id TEXT GENERATED ALWAYS AS (source_id || ':' || original_id) STORED, -- Globally unique ID
  raw_data JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processing_metadata JSONB,    -- Store temporary processing data
  validation_status TEXT DEFAULT 'pending',
  validation_timestamp TIMESTAMP,
  validation_errors JSONB,
  UNIQUE(institution_id, external_id)
);

-- Track validation failures
CREATE TABLE staging_validation_failures (
  id SERIAL PRIMARY KEY,
  staging_job_id INTEGER REFERENCES staging_jobs(id),
  validation_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  validation_type TEXT NOT NULL,
  field_name TEXT,
  error_message TEXT,
  raw_data JSONB
);
```

### 2. **Processing Flow**

* **Document Processing**
  ```javascript
  async function processDocuments(institutionId) {
    await db.transaction(async (trx) => {
      // Get unprocessed documents for this institution
      const docs = await trx('staging_documents')
        .where({
          institution_id: institutionId,
          processing_status: 'pending'
        })
        .limit(BATCH_SIZE);

      for (const doc of docs) {
        try {
          // 1. Extract job data
          const jobData = await extractJobData(doc);
          
          // 2. Identify or create company/division if needed
          let companyId, divisionId;
          if (doc.source_id !== 'nswgov') {
            // Handle private sector company identification
            ({ companyId, divisionId } = await resolveCompanyAndDivision(trx, doc));
          }
          
          // 3. Create staging job
          await createStagingJob(trx, {
            document_id: doc.id,
            institution_id: institutionId,
            company_id: companyId,
            division_id: divisionId,
            source_id: doc.source_id,
            original_id: jobData.id,  // Original ID from source
            raw_data: jobData
          });
          
          // 4. Mark document as processed
          await updateDocumentStatus(trx, doc.id, 'processed');
        } catch (error) {
          await handleDocumentFailure(trx, doc, error);
        }
      }
    });
  }
  ```

### 3. **Data Validation**

* **Validation Schema**
  ```sql
  -- Track validation failures
  CREATE TABLE staging_validation_failures (
    id SERIAL PRIMARY KEY,
    staging_job_id INTEGER REFERENCES staging_jobs(id),
    validation_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    validation_type TEXT NOT NULL,
    field_name TEXT,
    error_message TEXT,
    raw_data JSONB
  );

  -- Track validation status in staging jobs
  ALTER TABLE staging_jobs
    ADD COLUMN validation_status TEXT DEFAULT 'pending',
    ADD COLUMN validation_timestamp TIMESTAMP,
    ADD COLUMN validation_errors JSONB;
  ```

* **Validation Process**
  ```javascript
  const MANDATORY_FIELDS = {
    title: { type: 'string', minLength: 3 },
    description: { type: 'string', minLength: 10 },
    open_date: { type: 'date' },
    close_date: { type: 'date' },
    department: { type: 'string' },
    locations: { type: 'array', minItems: 1 }
  };

  async function validateStagingJobs(institutionId) {
    await db.transaction(async (trx) => {
      // Get processed but unvalidated jobs
      const stagingJobs = await trx('staging_jobs')
        .where({
          institution_id: institutionId,
          processed: true,
          validation_status: 'pending'
        });

      for (const job of stagingJobs) {
        const validationErrors = [];
        
        try {
          // 1. Validate mandatory fields
          const fieldErrors = validateMandatoryFields(job.raw_data);
          validationErrors.push(...fieldErrors);

          // 2. Validate relationships
          const relationErrors = await validateRelationships(trx, job);
          validationErrors.push(...relationErrors);

          // 3. Validate business rules
          const businessErrors = validateBusinessRules(job);
          validationErrors.push(...businessErrors);

          // 4. Update validation status
          if (validationErrors.length === 0) {
            await updateValidationStatus(trx, job.id, 'valid');
          } else {
            await recordValidationFailures(trx, job.id, validationErrors);
          }
        } catch (error) {
          await recordValidationFailures(trx, job.id, [{
            type: 'system_error',
            message: error.message
          }]);
        }
      }
    });
  }

  function validateMandatoryFields(data) {
    const errors = [];
    
    for (const [field, rules] of Object.entries(MANDATORY_FIELDS)) {
      // Check field presence
      if (!data[field]) {
        errors.push({
          type: 'missing_field',
          field,
          message: `Mandatory field '${field}' is missing`
        });
        continue;
      }

      // Type validation
      if (rules.type === 'string' && typeof data[field] !== 'string') {
        errors.push({
          type: 'invalid_type',
          field,
          message: `Field '${field}' must be a string`
        });
      }

      // Length validation for strings
      if (rules.type === 'string' && rules.minLength && data[field].length < rules.minLength) {
        errors.push({
          type: 'invalid_length',
          field,
          message: `Field '${field}' must be at least ${rules.minLength} characters`
        });
      }

      // Date validation
      if (rules.type === 'date') {
        const date = new Date(data[field]);
        if (isNaN(date.getTime())) {
          errors.push({
            type: 'invalid_date',
            field,
            message: `Field '${field}' must be a valid date`
          });
        }
      }

      // Array validation
      if (rules.type === 'array' && (!Array.isArray(data[field]) || data[field].length < rules.minItems)) {
        errors.push({
          type: 'invalid_array',
          field,
          message: `Field '${field}' must be an array with at least ${rules.minItems} item(s)`
        });
      }
    }

    return errors;
  }

  async function validateRelationships(trx, job) {
    const errors = [];

    // Validate company exists if specified
    if (job.company_id) {
      const company = await trx('companies').where('id', job.company_id).first();
      if (!company) {
        errors.push({
          type: 'invalid_relationship',
          field: 'company_id',
          message: `Referenced company ${job.company_id} does not exist`
        });
      }
    }

    // Validate division exists if specified
    if (job.division_id) {
      const division = await trx('divisions').where('id', job.division_id).first();
      if (!division) {
        errors.push({
          type: 'invalid_relationship',
          field: 'division_id',
          message: `Referenced division ${job.division_id} does not exist`
        });
      }
    }

    return errors;
  }

  function validateBusinessRules(job) {
    const errors = [];
    const data = job.raw_data;

    // Validate date ranges
    if (data.open_date && data.close_date) {
      const openDate = new Date(data.open_date);
      const closeDate = new Date(data.close_date);
      
      if (closeDate < openDate) {
        errors.push({
          type: 'invalid_date_range',
          message: 'Close date cannot be before open date'
        });
      }

      // Job cannot be open for more than 6 months
      const sixMonthsFromOpen = new Date(openDate);
      sixMonthsFromOpen.setMonth(sixMonthsFromOpen.getMonth() + 6);
      
      if (closeDate > sixMonthsFromOpen) {
        errors.push({
          type: 'invalid_date_range',
          message: 'Job cannot be open for more than 6 months'
        });
      }
    }

    // Validate source URLs if present
    if (data.source_url) {
      try {
        const url = new URL(data.source_url);
        const validDomains = {
          'nswgov': 'iworkfor.nsw.gov.au',
          'seek': 'seek.com.au'
        };
        
        if (validDomains[job.source_id] && !url.hostname.endsWith(validDomains[job.source_id])) {
          errors.push({
            type: 'invalid_url',
            message: `Source URL domain doesn't match source_id ${job.source_id}`
          });
        }
      } catch (e) {
        errors.push({
          type: 'invalid_url',
          message: 'Invalid source URL format'
        });
      }
    }

    return errors;
  }

  async function recordValidationFailures(trx, jobId, errors) {
    // Update job validation status
    await trx('staging_jobs')
      .where('id', jobId)
      .update({
        validation_status: 'failed',
        validation_timestamp: new Date(),
        validation_errors: JSON.stringify(errors)
      });

    // Record individual validation failures
    for (const error of errors) {
      await trx('staging_validation_failures').insert({
        staging_job_id: jobId,
        validation_type: error.type,
        field_name: error.field,
        error_message: error.message,
        raw_data: error
      });
    }
  }
  ```

### 4. **Data Promotion**

* **Required Schema Updates**
  ```sql
  -- First, add version tracking to jobs table
  ALTER TABLE jobs
    ADD COLUMN version INTEGER DEFAULT 1,
    ADD COLUMN first_seen_at TIMESTAMP DEFAULT NOW(),
    ADD COLUMN last_updated_at TIMESTAMP DEFAULT NOW();

  -- Create jobs history table
  CREATE TABLE jobs_history (
    id UUID NOT NULL,                    -- Same as jobs.id
    version INTEGER NOT NULL,            -- Incremental version number
    institution_id UUID NOT NULL,
    company_id UUID,
    division_id UUID,
    source_id TEXT NOT NULL,
    original_id TEXT NOT NULL,
    external_id TEXT NOT NULL,           -- Stored as source_id:original_id
    title TEXT NOT NULL,
    description TEXT,
    open_date DATE,
    close_date DATE,
    department TEXT,
    department_id TEXT,
    job_type TEXT,
    source_url TEXT,
    remuneration TEXT,
    recruiter JSONB,
    locations TEXT[],
    raw_json JSONB,                      -- Complete snapshot
    changed_fields TEXT[],               -- List of fields that changed
    change_type TEXT NOT NULL,           -- 'create', 'update', or 'archive'
    change_reason TEXT,                  -- Why the change occurred
    created_at TIMESTAMP DEFAULT NOW(),  -- When this version was created
    created_by TEXT,                     -- Process or user that made the change
    PRIMARY KEY (id, version)
  );

  -- Add indexes for efficient querying
  CREATE INDEX idx_jobs_history_id_version ON jobs_history(id, version DESC);
  CREATE INDEX idx_jobs_history_created_at ON jobs_history(created_at);
  ```

* **Updated Promotion Process**
  ```javascript
  async function promoteProcessedData(institutionId) {
    await db.transaction(async (trx) => {
      // Only promote validated jobs
      const stagingJobs = await trx('staging_jobs')
        .where({
          institution_id: institutionId,
          processed: true,
          validation_status: 'valid'
        });

      for (const job of stagingJobs) {
        // Check if job already exists
        const existingJob = await trx('jobs')
          .where({
            institution_id: job.institution_id,
            source_id: job.source_id,
            original_id: job.original_id
          })
          .first();

        if (existingJob) {
          // Compare for changes
          const changes = detectChanges(existingJob, job.raw_data);
          
          if (changes.hasChanges) {
            // Update existing job with new version
            await updateJobWithHistory(trx, existingJob, job, changes);
          }
        } else {
          // Create new job with initial version
          await createJobWithHistory(trx, job);
        }

        // Clean up staging data
        await cleanupStagingData(trx, job.id);
      }
    });
  }

  function detectChanges(existingJob, newData) {
    const changes = {
      hasChanges: false,
      changedFields: [],
      changeType: 'update',
      changeReason: ''
    };

    // Fields to compare (excluding metadata fields)
    const compareFields = [
      'title', 'description', 'open_date', 'close_date',
      'department', 'job_type', 'remuneration', 'locations'
    ];

    for (const field of compareFields) {
      if (JSON.stringify(existingJob[field]) !== JSON.stringify(newData[field])) {
        changes.hasChanges = true;
        changes.changedFields.push(field);
      }
    }

    // Determine change type and reason
    if (changes.hasChanges) {
      if (!existingJob.close_date && newData.close_date) {
        changes.changeType = 'update';
        changes.changeReason = 'Job closing date added';
      } else if (changes.changedFields.includes('description')) {
        changes.changeType = 'update';
        changes.changeReason = 'Job description updated';
      } else {
        changes.changeType = 'update';
        changes.changeReason = 'General job details updated';
      }
    }

    return changes;
  }

  async function createJobWithHistory(trx, stagingJob) {
    // Insert new job
    const [job] = await trx('jobs').insert({
      ...stagingJob.raw_data,
      institution_id: stagingJob.institution_id,
      company_id: stagingJob.company_id,
      division_id: stagingJob.division_id,
      source_id: stagingJob.source_id,
      original_id: stagingJob.original_id,
      version: 1,
      first_seen_at: new Date(),
      last_updated_at: new Date()
    }).returning('*');

    // Create initial history record
    await trx('jobs_history').insert({
      ...job,
      version: 1,
      change_type: 'create',
      change_reason: 'Initial job creation',
      changed_fields: Object.keys(stagingJob.raw_data),
      created_by: 'etl_pipeline'
    });

    return job;
  }

  async function updateJobWithHistory(trx, existingJob, stagingJob, changes) {
    // Increment version
    const newVersion = existingJob.version + 1;

    // Update existing job
    const [updatedJob] = await trx('jobs')
      .where('id', existingJob.id)
      .update({
        ...stagingJob.raw_data,
        version: newVersion,
        last_updated_at: new Date()
      })
      .returning('*');

    // Create history record
    await trx('jobs_history').insert({
      ...updatedJob,
      version: newVersion,
      change_type: changes.changeType,
      change_reason: changes.changeReason,
      changed_fields: changes.changedFields,
      created_by: 'etl_pipeline'
    });

    return updatedJob;
  }
  ```

* **Job History Queries**
  ```sql
  -- Get complete history of a job
  SELECT * FROM jobs_history 
  WHERE id = :job_id 
  ORDER BY version;

  -- Get specific version of a job
  SELECT * FROM jobs_history 
  WHERE id = :job_id AND version = :version;

  -- Get changes between versions
  WITH versions AS (
    SELECT 
      id,
      version,
      changed_fields,
      change_reason,
      created_at,
      LAG(raw_json) OVER (PARTITION BY id ORDER BY version) as prev_json,
      raw_json as curr_json
    FROM jobs_history
    WHERE id = :job_id
  )
  SELECT 
    version,
    changed_fields,
    change_reason,
    created_at,
    prev_json,
    curr_json
  FROM versions
  WHERE prev_json IS NOT NULL;
  ```

### Benefits of Job Versioning

1. **Audit Trail**
   - Complete history of all changes
   - When changes occurred
   - What specifically changed
   - Why changes were made

2. **Analytics**
   - Track job evolution over time
   - Analyze common modification patterns
   - Monitor update frequencies
   - Identify trending changes

3. **AI Training**
   - Rich dataset for ML models
   - Job evolution patterns
   - Change prediction models
   - Content improvement analysis

4. **Quality Control**
   - Track unauthorized changes
   - Validate update patterns
   - Monitor data quality over time
   - Detect anomalous updates

### 5. **Institution-Specific Processing**

* **NSW Government**
  - Direct job to role mapping
  - Standard capability framework
  - Known division structure

* **Private Sector**
  - Company and division detection
  - Role standardization
  - Capability mapping to standard framework

* **Configuration**
  ```javascript
  const institutionConfigs = {
    'nsw-gov': {
      sourceId: 'nswgov',
      capabilityFramework: 'nsw-core-capabilities',
      roleMapping: 'nsw-role-types',
      // ...
    },
    'private-sector': {
      sourceId: 'seek',
      companyDetection: true,
      roleStandardization: true,
      // ...
    }
  };
  ```

### 6. **Daily Orchestration**

```javascript
async function runDaily() {
  // Get all active institutions
  const institutions = await db('institutions').where({ active: true });

  for (const institution of institutions) {
    // 1. Run source-specific scrapers
    await runScrapers(institution);

    // 2. Process documents
    await processDocuments(institution.id);

    // 3. Validate processed jobs
    await validateStagingJobs(institution.id);

    // 4. Promote validated jobs
    await promoteProcessedData(institution.id);

    // 5. Archive old jobs
    await archiveOldJobs(institution.id);

    // 6. Generate reports
    await generateDailyReport(institution.id);
  }
}
```

---

## Implementation Phases

### Phase 1: Institution Support (Week 1)
* [ ] Add institution configuration system
* [ ] Modify scrapers to support multiple institutions
* [ ] Add institution-specific processing rules

### Phase 2: Staging System (Week 2)
* [ ] Set up staging tables
* [ ] Implement document processing pipeline
* [ ] Add error handling and retry logic

### Phase 3: Data Promotion (Week 3)
* [ ] Build intelligent upsert system
* [ ] Implement relationship handling
* [ ] Add data validation and cleanup

### Phase 4: Monitoring (Week 4)
* [ ] Add institution-specific reporting
* [ ] Implement error alerting
* [ ] Create monitoring dashboard

---

## Monitoring & Maintenance

### Key Metrics
* Jobs processed per source per day
* Processing time per job
* Error rates by source/stage
* Database size and growth rate
* Job archival statistics

### Alerts
* Scraper failures
* Processing bottlenecks
* Database issues
* Data quality problems

---

## Next Steps

1. Review and approve database schema changes
2. Begin Phase 1 implementation
3. Set up development environment
4. Create test data sets
5. Schedule weekly progress reviews
