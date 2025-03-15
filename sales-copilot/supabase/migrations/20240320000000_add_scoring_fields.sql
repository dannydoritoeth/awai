-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA net;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA net TO postgres;
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA net TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA cron TO postgres;

-- Add scoring fields to hubspot_accounts table
ALTER TABLE hubspot_accounts
ADD COLUMN last_scoring_run TIMESTAMP WITH TIME ZONE,
ADD COLUMN last_scoring_counts JSONB DEFAULT '{"contacts": 0, "companies": 0, "deals": 0}'::jsonb;

-- Schedule batch scoring to run daily at midnight UTC
SELECT cron.schedule(
    'batch-scoring',
    '0 0 * * *',  -- At 00:00 (midnight) every day
    $$
    SELECT net.http_post(
        url:=current_setting('app.edge_function_url') || '/score-batch',
        headers:=jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.edge_function_key')
        ),
        body:=jsonb_build_object(
            'timestamp', now()
        )
    ) AS request_id;
    $$
);

