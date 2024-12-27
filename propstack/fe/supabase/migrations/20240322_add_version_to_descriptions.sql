-- Add version column to generated_descriptions table
ALTER TABLE generated_descriptions 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_generated_descriptions_version 
ON generated_descriptions(version); 