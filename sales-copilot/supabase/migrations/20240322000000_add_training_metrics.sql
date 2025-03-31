-- Add training metrics columns to hubspot_accounts table
ALTER TABLE hubspot_accounts
ADD COLUMN minimum_ideal_contacts INTEGER DEFAULT 10,
ADD COLUMN minimum_less_ideal_contacts INTEGER DEFAULT 10,
ADD COLUMN current_ideal_contacts INTEGER DEFAULT 0,
ADD COLUMN current_less_ideal_contacts INTEGER DEFAULT 0,

ADD COLUMN minimum_ideal_companies INTEGER DEFAULT 10,
ADD COLUMN minimum_less_ideal_companies INTEGER DEFAULT 10,
ADD COLUMN current_ideal_companies INTEGER DEFAULT 0,
ADD COLUMN current_less_ideal_companies INTEGER DEFAULT 0,

ADD COLUMN minimum_ideal_deals INTEGER DEFAULT 10,
ADD COLUMN minimum_less_ideal_deals INTEGER DEFAULT 10,
ADD COLUMN current_ideal_deals INTEGER DEFAULT 0,
ADD COLUMN current_less_ideal_deals INTEGER DEFAULT 0,

ADD COLUMN last_training_date TIMESTAMP WITH TIME ZONE;

-- Add comments to explain the columns
COMMENT ON COLUMN hubspot_accounts.minimum_ideal_contacts IS 'Minimum number of ideal contacts required before training';
COMMENT ON COLUMN hubspot_accounts.minimum_less_ideal_contacts IS 'Minimum number of less ideal contacts required before training';
COMMENT ON COLUMN hubspot_accounts.current_ideal_contacts IS 'Current count of ideal contacts';
COMMENT ON COLUMN hubspot_accounts.current_less_ideal_contacts IS 'Current count of less ideal contacts';

COMMENT ON COLUMN hubspot_accounts.minimum_ideal_companies IS 'Minimum number of ideal companies required before training';
COMMENT ON COLUMN hubspot_accounts.minimum_less_ideal_companies IS 'Minimum number of less ideal companies required before training';
COMMENT ON COLUMN hubspot_accounts.current_ideal_companies IS 'Current count of ideal companies';
COMMENT ON COLUMN hubspot_accounts.current_less_ideal_companies IS 'Current count of less ideal companies';

COMMENT ON COLUMN hubspot_accounts.minimum_ideal_deals IS 'Minimum number of ideal deals required before training';
COMMENT ON COLUMN hubspot_accounts.minimum_less_ideal_deals IS 'Minimum number of less ideal deals required before training';
COMMENT ON COLUMN hubspot_accounts.current_ideal_deals IS 'Current count of ideal deals';
COMMENT ON COLUMN hubspot_accounts.current_less_ideal_deals IS 'Current count of less ideal deals';

COMMENT ON COLUMN hubspot_accounts.last_training_date IS 'Timestamp of the last training run'; 