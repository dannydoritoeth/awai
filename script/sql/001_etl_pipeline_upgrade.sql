-- ETL Pipeline Upgrade Migration
-- Adds staging tables, validation tracking, and job versioning

BEGIN;

-- Create staging tables
CREATE TABLE IF NOT EXISTS staging_documents (
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

CREATE TABLE IF NOT EXISTS staging_failed_documents (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES staging_documents(id),
    failure_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    error_type TEXT NOT NULL,
    error_details TEXT,
    retry_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS staging_jobs (
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

CREATE TABLE IF NOT EXISTS staging_validation_failures (
    id SERIAL PRIMARY KEY,
    staging_job_id INTEGER REFERENCES staging_jobs(id),
    validation_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    validation_type TEXT NOT NULL,
    field_name TEXT,
    error_message TEXT,
    raw_data JSONB
);

-- Add version tracking to jobs table
ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS source_id TEXT,
    ADD COLUMN IF NOT EXISTS original_id TEXT,
    ADD COLUMN IF NOT EXISTS external_id TEXT GENERATED ALWAYS AS (source_id || ':' || original_id) STORED,
    ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMP DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMP DEFAULT NOW();

-- Drop old constraints if they exist
ALTER TABLE jobs 
    DROP CONSTRAINT IF EXISTS jobs_external_id_key;

-- Add new constraints
ALTER TABLE jobs
    ADD CONSTRAINT jobs_institution_source_original_unique 
    UNIQUE(company_id, source_id, original_id);

-- Create jobs history table
CREATE TABLE IF NOT EXISTS jobs_history (
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
CREATE INDEX IF NOT EXISTS idx_jobs_history_id_version ON jobs_history(id, version DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_history_created_at ON jobs_history(created_at);

-- Add indexes for staging tables
CREATE INDEX IF NOT EXISTS idx_staging_documents_status ON staging_documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_staging_documents_institution ON staging_documents(institution_id);
CREATE INDEX IF NOT EXISTS idx_staging_jobs_validation ON staging_jobs(validation_status);
CREATE INDEX IF NOT EXISTS idx_staging_jobs_institution ON staging_jobs(institution_id);

-- Create functions for version management
CREATE OR REPLACE FUNCTION update_job_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.version := OLD.version + 1;
    NEW.last_updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for version management
DROP TRIGGER IF EXISTS tr_update_job_version ON jobs;
CREATE TRIGGER tr_update_job_version
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_job_version();

-- Create function to archive job
CREATE OR REPLACE FUNCTION archive_job(p_job_id UUID, p_reason TEXT)
RETURNS VOID AS $$
BEGIN
    -- Update jobs table
    UPDATE jobs 
    SET 
        is_archived = true,
        last_updated_at = NOW()
    WHERE id = p_job_id;

    -- Create history record
    INSERT INTO jobs_history (
        id, 
        version,
        institution_id,
        company_id,
        division_id,
        source_id,
        original_id,
        external_id,
        title,
        description,
        open_date,
        close_date,
        department,
        department_id,
        job_type,
        source_url,
        remuneration,
        recruiter,
        locations,
        raw_json,
        changed_fields,
        change_type,
        change_reason,
        created_by
    )
    SELECT 
        id,
        version + 1,
        institution_id,
        company_id,
        division_id,
        source_id,
        original_id,
        external_id,
        title,
        description,
        open_date,
        close_date,
        department,
        department_id,
        job_type,
        source_url,
        remuneration,
        recruiter,
        locations,
        to_jsonb(jobs.*) as raw_json,
        ARRAY['is_archived'] as changed_fields,
        'archive' as change_type,
        p_reason as change_reason,
        'system' as created_by
    FROM jobs
    WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Add pg_trgm extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create function for fuzzy company matching
CREATE OR REPLACE FUNCTION fuzzy_company_match(company_name text, similarity_threshold float)
RETURNS TABLE (
    id uuid,
    name text,
    normalized_name text,
    similarity float
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.normalized_name,
        GREATEST(
            similarity(c.normalized_name, company_name),
            similarity(c.name, company_name)
        ) as similarity
    FROM companies c
    WHERE 
        similarity(c.normalized_name, company_name) > similarity_threshold
        OR similarity(c.name, company_name) > similarity_threshold
    ORDER BY similarity DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql;

COMMIT; 