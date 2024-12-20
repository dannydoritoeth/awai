-- Add status enum to generated_descriptions table
ALTER TABLE generated_descriptions 
DROP CONSTRAINT IF EXISTS generated_descriptions_status_check;

ALTER TABLE generated_descriptions 
ADD CONSTRAINT generated_descriptions_status_check 
CHECK (status IN ('processing', 'generating', 'completed', 'error'));

-- Set default status
ALTER TABLE generated_descriptions 
ALTER COLUMN status SET DEFAULT 'processing';

-- Add status column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'generated_descriptions' AND column_name = 'status') 
  THEN
    ALTER TABLE generated_descriptions ADD COLUMN status text;
  END IF;
END $$;

-- Update any null statuses to 'completed' for existing records
UPDATE generated_descriptions 
SET status = 'completed' 
WHERE status IS NULL;

-- Make status required
ALTER TABLE generated_descriptions 
ALTER COLUMN status SET NOT NULL; 