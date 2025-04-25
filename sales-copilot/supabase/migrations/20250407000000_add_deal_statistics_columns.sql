-- Add columns for tracking deal statistics
ALTER TABLE hubspot_accounts
ADD COLUMN ideal_low NUMERIC,
ADD COLUMN ideal_high NUMERIC,
ADD COLUMN ideal_median NUMERIC,
ADD COLUMN ideal_count INTEGER DEFAULT 0,
ADD COLUMN ideal_last_trained TIMESTAMP WITH TIME ZONE,
ADD COLUMN nonideal_low NUMERIC,
ADD COLUMN nonideal_high NUMERIC,
ADD COLUMN nonideal_median NUMERIC,
ADD COLUMN nonideal_count INTEGER DEFAULT 0,
ADD COLUMN nonideal_last_trained TIMESTAMP WITH TIME ZONE;

-- Add comments explaining the columns
COMMENT ON COLUMN hubspot_accounts.ideal_low IS 'Lowest amount among ideal deals';
COMMENT ON COLUMN hubspot_accounts.ideal_high IS 'Highest amount among ideal deals';
COMMENT ON COLUMN hubspot_accounts.ideal_median IS 'Median amount of ideal deals';
COMMENT ON COLUMN hubspot_accounts.ideal_count IS 'Total count of ideal deals with valid amounts';
COMMENT ON COLUMN hubspot_accounts.ideal_last_trained IS 'Timestamp of the last update for ideal deals statistics';

COMMENT ON COLUMN hubspot_accounts.nonideal_low IS 'Lowest amount among non-ideal deals';
COMMENT ON COLUMN hubspot_accounts.nonideal_high IS 'Highest amount among non-ideal deals';
COMMENT ON COLUMN hubspot_accounts.nonideal_median IS 'Median amount of non-ideal deals';
COMMENT ON COLUMN hubspot_accounts.nonideal_count IS 'Total count of non-ideal deals with valid amounts';
COMMENT ON COLUMN hubspot_accounts.nonideal_last_trained IS 'Timestamp of the last update for non-ideal deals statistics'; 