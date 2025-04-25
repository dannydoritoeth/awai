-- Create enum for object types
CREATE TYPE hubspot_object_type AS ENUM ('deal', 'contact', 'company');

-- Create enum for status types
CREATE TYPE processing_status AS ENUM ('pending', 'in_progress', 'completed', 'failed');

-- Create enum for classification
CREATE TYPE object_classification AS ENUM ('ideal', 'nonideal', 'other');

-- Create updated_at function if it doesn't exist
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create table for tracking hubspot object status
CREATE TABLE hubspot_object_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    portal_id VARCHAR(255) NOT NULL,
    object_type hubspot_object_type NOT NULL,
    object_id VARCHAR(255) NOT NULL,
    classification object_classification NOT NULL,
    training_status processing_status DEFAULT 'pending',
    training_date TIMESTAMPTZ,
    training_error TEXT,
    scoring_status processing_status DEFAULT 'pending',
    scoring_date TIMESTAMPTZ,
    scoring_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Composite index for efficient lookups
    CONSTRAINT unique_object_per_portal UNIQUE (portal_id, object_type, object_id)
);

-- Add foreign key to hubspot_accounts
ALTER TABLE hubspot_object_status
ADD CONSTRAINT fk_hubspot_account
FOREIGN KEY (portal_id)
REFERENCES hubspot_accounts(portal_id)
ON DELETE CASCADE;

-- Create indexes for common queries
CREATE INDEX idx_portal_type_status ON hubspot_object_status(portal_id, object_type, training_status);
CREATE INDEX idx_portal_scoring ON hubspot_object_status(portal_id, scoring_status);
CREATE INDEX idx_portal_classification ON hubspot_object_status(portal_id, classification);
CREATE INDEX idx_training_date ON hubspot_object_status(training_date);
CREATE INDEX idx_scoring_date ON hubspot_object_status(scoring_date);

-- Add updated_at trigger
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON hubspot_object_status
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Add comment to table
COMMENT ON TABLE hubspot_object_status IS 'Tracks the training and scoring status of HubSpot objects (deals, contacts, companies)';

-- Add comments to columns
COMMENT ON COLUMN hubspot_object_status.portal_id IS 'HubSpot portal ID';
COMMENT ON COLUMN hubspot_object_status.object_type IS 'Type of HubSpot object (deal, contact, company)';
COMMENT ON COLUMN hubspot_object_status.object_id IS 'HubSpot object ID';
COMMENT ON COLUMN hubspot_object_status.classification IS 'Whether this object is from an ideal, non-ideal, or other case';
COMMENT ON COLUMN hubspot_object_status.training_status IS 'Current status of training for this object';
COMMENT ON COLUMN hubspot_object_status.training_date IS 'Last time this object was trained';
COMMENT ON COLUMN hubspot_object_status.training_error IS 'Error message if training failed';
COMMENT ON COLUMN hubspot_object_status.scoring_status IS 'Current status of scoring for this object';
COMMENT ON COLUMN hubspot_object_status.scoring_date IS 'Last time this object was scored';
COMMENT ON COLUMN hubspot_object_status.scoring_error IS 'Error message if scoring failed'; 