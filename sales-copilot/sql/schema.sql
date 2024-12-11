-- Enable trigram extension for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Drop existing enum dependencies first
DROP TABLE IF EXISTS customer_integrations CASCADE;
DROP TABLE IF EXISTS integrations CASCADE;
DROP TYPE IF EXISTS integration_type CASCADE;

-- Recreate the enum with both types
CREATE TYPE integration_type AS ENUM ('pipedrive', 'agentbox');

-- Recreate the integrations table
CREATE TABLE integrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type integration_type NOT NULL,
    auth_type auth_type NOT NULL,
    config JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create enum for auth types
CREATE TYPE auth_type AS ENUM ('oauth2', 'api_key');

-- Table to store customers
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Recreate the customer_integrations table
CREATE TABLE customer_integrations (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    integration_id INTEGER REFERENCES integrations(id),
    credentials JSONB NOT NULL,
    auth_status VARCHAR(50) DEFAULT 'pending',
    access_token_expires_at TIMESTAMP WITH TIME ZONE,
    refresh_token_expires_at TIMESTAMP WITH TIME ZONE,
    connection_settings JSONB,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_full_sync TIMESTAMP,
    force_full_sync BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(customer_id, integration_id)
);

-- Table to track sync status and history
CREATE TABLE sync_history (
    id SERIAL PRIMARY KEY,
    customer_integration_id INTEGER REFERENCES customer_integrations(id),
    status VARCHAR(50) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    records_processed INTEGER DEFAULT 0,
    error_message TEXT,
    sync_type VARCHAR(50) NOT NULL -- 'full' or 'incremental'
);

-- Table to store webhook configurations
CREATE TABLE webhook_configurations (
    id SERIAL PRIMARY KEY,
    customer_integration_id INTEGER REFERENCES customer_integrations(id),
    event_type VARCHAR(100) NOT NULL,
    endpoint_url TEXT NOT NULL,
    secret_key TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table to store entity scores
CREATE TABLE entity_scores (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    integration_id INTEGER REFERENCES integrations(id),
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    score INTEGER NOT NULL,
    factors JSONB,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT score_range CHECK (score >= 1 AND score <= 99),
    UNIQUE(customer_id, integration_id, entity_id, entity_type)
);

-- Table to store data quality reports
CREATE TABLE data_quality_reports (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    integration_id INTEGER REFERENCES integrations(id),
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    quality_score INTEGER NOT NULL,
    issues JSONB,
    warnings JSONB,
    last_checked TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT quality_score_range CHECK (quality_score >= 0 AND quality_score <= 100),
    UNIQUE(customer_id, integration_id, entity_id, entity_type)
);

-- Integration-specific tables for duplicate checking
CREATE TABLE agentbox_contacts (
    id TEXT NOT NULL,
    customer_id INTEGER REFERENCES customers(id),
    email TEXT,
    mobile TEXT,
    first_name TEXT,
    last_name TEXT,
    source TEXT,
    type TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (customer_id, id)
);

CREATE TABLE pipedrive_contacts (
    id TEXT NOT NULL,
    customer_id INTEGER REFERENCES customers(id),
    email JSONB, -- Array of email objects
    phone JSONB, -- Array of phone objects
    first_name TEXT,
    last_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (customer_id, id)
);

-- Create indexes for better query performance
CREATE INDEX idx_customer_integrations_customer_id ON customer_integrations(customer_id);
CREATE INDEX idx_sync_history_customer_integration_id ON sync_history(customer_integration_id);
CREATE INDEX idx_webhook_configurations_customer_integration_id ON webhook_configurations(customer_integration_id);
CREATE INDEX idx_entity_scores_lookup ON entity_scores(customer_id, integration_id, entity_id, entity_type);
CREATE INDEX idx_entity_scores_type ON entity_scores(entity_type);
CREATE INDEX idx_data_quality_reports_lookup ON data_quality_reports(customer_id, integration_id, entity_id, entity_type);
CREATE INDEX idx_data_quality_reports_score ON data_quality_reports(quality_score);

-- Indexes for duplicate checking
CREATE INDEX idx_agentbox_contacts_email ON agentbox_contacts(customer_id, email);
CREATE INDEX idx_agentbox_contacts_mobile ON agentbox_contacts(customer_id, mobile);
CREATE INDEX idx_agentbox_contacts_name ON agentbox_contacts(customer_id, first_name, last_name);
CREATE INDEX idx_pipedrive_contacts_name ON pipedrive_contacts(customer_id, first_name, last_name);

-- Grant permissions to application user
GRANT USAGE ON SCHEMA public TO tapuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tapuser;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tapuser;
GRANT USAGE ON TYPE integration_type TO tapuser;
GRANT USAGE ON TYPE auth_type TO tapuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tapuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO tapuser;