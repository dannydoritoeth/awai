-- Create failed webhook events table
CREATE TABLE IF NOT EXISTS failed_webhook_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL,
    stripe_event_id TEXT,
    raw_payload JSONB NOT NULL,
    error TEXT,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_failed_webhook_events_event_type ON failed_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_failed_webhook_events_created_at ON failed_webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_failed_webhook_events_processed ON failed_webhook_events(processed);

-- Add trigger for updating updated_at
CREATE TRIGGER update_failed_webhook_events_updated_at
    BEFORE UPDATE ON failed_webhook_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT ALL ON TABLE failed_webhook_events TO authenticated;
GRANT ALL ON TABLE failed_webhook_events TO service_role; 