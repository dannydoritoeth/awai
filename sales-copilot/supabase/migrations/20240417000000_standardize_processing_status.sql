-- First add 'queued' to the enum in its own transaction
BEGIN;
ALTER TYPE processing_status ADD VALUE IF NOT EXISTS 'queued';
COMMIT;

-- Now update the records in a separate transaction
BEGIN;
-- Update all 'pending' statuses to 'queued'
UPDATE hubspot_object_status
SET 
    training_status = CASE 
        WHEN training_status = 'pending' THEN 'queued'::processing_status 
        ELSE training_status 
    END,
    scoring_status = CASE 
        WHEN scoring_status = 'pending' THEN 'queued'::processing_status 
        ELSE scoring_status 
    END;

-- Add comment to clarify status usage
COMMENT ON COLUMN hubspot_object_status.training_status IS 'Status values: queued (needs processing), in_progress (currently being processed), completed (finished), failed (error occurred)';
COMMENT ON COLUMN hubspot_object_status.scoring_status IS 'Status values: queued (needs processing), in_progress (currently being processed), completed (finished), failed (error occurred)';

-- Update the type comment
COMMENT ON TYPE processing_status IS 'Status values: queued (needs processing), in_progress (currently being processed), completed (finished), failed (error occurred)';
COMMIT; 