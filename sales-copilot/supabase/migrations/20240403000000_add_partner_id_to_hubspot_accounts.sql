-- Add partner_id column to hubspot_accounts
ALTER TABLE hubspot_accounts
ADD COLUMN partner_id UUID REFERENCES partners(id);

-- Create index for faster lookups
CREATE INDEX idx_hubspot_accounts_partner_id ON hubspot_accounts(partner_id);

-- Add comment explaining the column
COMMENT ON COLUMN hubspot_accounts.partner_id IS 'Reference to the partner who referred this HubSpot account. Can only be set once during initial installation.'; 