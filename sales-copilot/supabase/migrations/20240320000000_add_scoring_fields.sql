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

-- Create a function to schedule the batch scoring
CREATE OR REPLACE FUNCTION schedule_batch_scoring()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = net, pg_temp
AS $$
BEGIN
  -- Schedule the function to run every hour
  PERFORM cron.schedule(
    'batch-scoring',
    '0 * * * *',
    $$
    select
      net.http_post(
          url:='https://rtalhjaoxlcqmxppuhhz.supabase.co/functions/v1/score-batch',
          headers:=jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0YWxoamFveGxjcW14cHB1aGh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTYzOTM0NCwiZXhwIjoyMDU3MjE1MzQ0fQ.-LHwqxbkHHxjk3C9DYyTzWs3gi30EB09xEHV94ko8sw'
          ),
          body:=jsonb_build_object(
            'timestamp', now()
          )
      ) as request_id;
    $$
  );
END;
$$;

-- Execute the scheduling function
SELECT schedule_batch_scoring(); 