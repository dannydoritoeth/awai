-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA extensions TO postgres;

-- Add scoring fields to hubspot_accounts table
ALTER TABLE hubspot_accounts
ADD COLUMN last_scoring_run TIMESTAMP WITH TIME ZONE,
ADD COLUMN last_scoring_counts JSONB DEFAULT '{"contacts": 0, "companies": 0, "deals": 0}'::jsonb;

-- Create a function to schedule the batch scoring
CREATE OR REPLACE FUNCTION schedule_batch_scoring()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Schedule the function to run every hour
  PERFORM cron.schedule(
    'batch-scoring',  -- job name
    '0 * * * *',      -- every hour
    $$
    net.http_post(
      'https://rtalhjaoxlcqmxppuhhz.supabase.co/functions/v1/score-batch',
      headers => '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0YWxoamFveGxjcW14cHB1aGh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTYzOTM0NCwiZXhwIjoyMDU3MjE1MzQ0fQ.-LHwqxbkHHxjk3C9DYyTzWs3gi30EB09xEHV94ko8sw", "Content-Type": "application/json"}'::jsonb
    );
    $$
  );
END;
$$;

-- Execute the scheduling function
SELECT schedule_batch_scoring(); 