-- Add last_processed column to hubspot_object_status
ALTER TABLE hubspot_object_status
ADD COLUMN last_processed TIMESTAMPTZ;

-- Add index for querying by last processed date
CREATE INDEX idx_last_processed ON hubspot_object_status(last_processed);

-- Add comment explaining the column
COMMENT ON COLUMN hubspot_object_status.last_processed IS 'Timestamp of the last time this record was processed (training or scoring)';

-- Update existing records to have last_processed match their most recent training_date or scoring_date
UPDATE hubspot_object_status
SET last_processed = GREATEST(training_date, scoring_date)
WHERE training_date IS NOT NULL OR scoring_date IS NOT NULL; 