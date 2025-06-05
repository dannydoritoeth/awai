-- Add support for multiple capability frameworks
BEGIN;

-- Create capability frameworks table
CREATE TABLE IF NOT EXISTS capability_frameworks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    levels TEXT[] NOT NULL,
    groups TEXT[] NOT NULL,
    institution_id UUID REFERENCES institutions(id),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX idx_capability_frameworks_institution ON capability_frameworks(institution_id);
CREATE INDEX idx_capability_frameworks_default ON capability_frameworks(is_default) WHERE is_default = true;

-- Add framework type to capabilities table
ALTER TABLE capabilities
    ADD COLUMN IF NOT EXISTS framework_type UUID REFERENCES capability_frameworks(id);

-- Add framework type to job_capabilities table
ALTER TABLE job_capabilities
    ADD COLUMN IF NOT EXISTS framework_type UUID REFERENCES capability_frameworks(id);

-- Add NSW framework preference to institutions
ALTER TABLE institutions
    ADD COLUMN IF NOT EXISTS uses_nsw_framework BOOLEAN DEFAULT FALSE;

-- Insert NSW Government Framework as default
INSERT INTO capability_frameworks (
    name,
    description,
    levels,
    groups,
    is_default
) VALUES (
    'NSW Government Capability Framework',
    'The NSW Public Sector Capability Framework',
    ARRAY['Foundational', 'Intermediate', 'Adept', 'Advanced', 'Highly Advanced'],
    ARRAY['Personal Attributes', 'Relationships', 'Results', 'Business Enablers'],
    TRUE
) ON CONFLICT DO NOTHING;

-- Create function to update framework timestamps
CREATE OR REPLACE FUNCTION update_framework_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for timestamp updates
CREATE TRIGGER tr_update_framework_timestamp
    BEFORE UPDATE ON capability_frameworks
    FOR EACH ROW
    EXECUTE FUNCTION update_framework_timestamp();

-- Add constraints to ensure only one default framework
CREATE UNIQUE INDEX idx_capability_frameworks_single_default 
    ON capability_frameworks (is_default) 
    WHERE is_default = true;

-- Add constraints to ensure framework consistency
ALTER TABLE capabilities
    ADD CONSTRAINT capabilities_framework_consistency
    CHECK (
        (framework_type IS NOT NULL) OR
        (framework_type IS NULL AND behavioral_indicators IS NOT NULL)
    );

ALTER TABLE job_capabilities
    ADD CONSTRAINT job_capabilities_framework_consistency
    CHECK (framework_type IS NOT NULL);

COMMIT; 