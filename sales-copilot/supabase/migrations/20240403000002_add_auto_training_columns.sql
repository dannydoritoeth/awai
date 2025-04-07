-- Add columns for tracking auto-training status
ALTER TABLE hubspot_accounts
ADD COLUMN last_auto_training_date timestamp with time zone,
ADD COLUMN auto_training_ideal_count integer DEFAULT 0,
ADD COLUMN auto_training_nonideal_count integer DEFAULT 0;

-- Add index for querying by last training date
CREATE INDEX idx_hubspot_accounts_last_auto_training_date 
ON hubspot_accounts(last_auto_training_date);

-- Add comment explaining the columns
COMMENT ON COLUMN hubspot_accounts.last_auto_training_date IS 'Timestamp of the last successful automatic training run';
COMMENT ON COLUMN hubspot_accounts.auto_training_ideal_count IS 'Number of ideal deals used in the last automatic training';
COMMENT ON COLUMN hubspot_accounts.auto_training_nonideal_count IS 'Number of non-ideal deals used in the last automatic training'; 