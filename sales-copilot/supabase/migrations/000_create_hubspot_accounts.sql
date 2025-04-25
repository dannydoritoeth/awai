-- Create HubSpot accounts table
CREATE TABLE IF NOT EXISTS hubspot_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    portal_id TEXT NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    token_type TEXT NOT NULL DEFAULT 'bearer',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_hubspot_accounts_portal_id ON hubspot_accounts(portal_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_accounts_status ON hubspot_accounts(status);

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_hubspot_accounts_updated_at ON hubspot_accounts;
CREATE TRIGGER update_hubspot_accounts_updated_at
    BEFORE UPDATE ON hubspot_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions to authenticated users and service role
GRANT ALL ON TABLE hubspot_accounts TO authenticated;
GRANT ALL ON TABLE hubspot_accounts TO service_role; 