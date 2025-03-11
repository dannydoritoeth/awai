-- Create HubSpot accounts table
CREATE TABLE hubspot_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    portal_id TEXT NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for faster lookups
CREATE INDEX idx_hubspot_accounts_portal_id ON hubspot_accounts(portal_id);
CREATE INDEX idx_hubspot_accounts_status ON hubspot_accounts(status);

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_hubspot_accounts_updated_at
    BEFORE UPDATE ON hubspot_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE hubspot_accounts ENABLE ROW LEVEL SECURITY;

-- Only allow authenticated users to view their own portal data
CREATE POLICY "Users can view their own portal data"
    ON hubspot_accounts
    FOR SELECT
    TO authenticated
    USING (
        portal_id IN (
            SELECT portal_id
            FROM user_hubspot_portals
            WHERE user_id = auth.uid()
        )
    );

-- Only allow authenticated users to update their own portal data
CREATE POLICY "Users can update their own portal data"
    ON hubspot_accounts
    FOR UPDATE
    TO authenticated
    USING (
        portal_id IN (
            SELECT portal_id
            FROM user_hubspot_portals
            WHERE user_id = auth.uid()
        )
    );

-- Create junction table for user-portal relationships
CREATE TABLE user_hubspot_portals (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    portal_id TEXT REFERENCES hubspot_accounts(portal_id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, portal_id)
);

-- Add RLS policies for junction table
ALTER TABLE user_hubspot_portals ENABLE ROW LEVEL SECURITY;

-- Users can view their own portal associations
CREATE POLICY "Users can view their own portal associations"
    ON user_hubspot_portals
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Only admins can manage portal associations
CREATE POLICY "Admins can manage portal associations"
    ON user_hubspot_portals
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM user_hubspot_portals
            WHERE user_id = auth.uid()
            AND role = 'admin'
            AND portal_id = user_hubspot_portals.portal_id
        )
    ); 