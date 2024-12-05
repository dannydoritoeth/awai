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

-- Create indexes for better query performance
CREATE INDEX idx_customer_integrations_customer_id ON customer_integrations(customer_id);
CREATE INDEX idx_sync_history_customer_integration_id ON sync_history(customer_integration_id);
CREATE INDEX idx_webhook_configurations_customer_integration_id ON webhook_configurations(customer_integration_id);

-- Grant permissions to application user
GRANT USAGE ON SCHEMA public TO tapuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tapuser;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tapuser;
GRANT USAGE ON TYPE integration_type TO tapuser;
GRANT USAGE ON TYPE auth_type TO tapuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tapuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO tapuser;