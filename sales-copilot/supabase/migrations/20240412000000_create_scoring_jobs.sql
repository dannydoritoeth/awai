-- Create scoring_jobs table
CREATE TABLE IF NOT EXISTS scoring_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id TEXT NOT NULL,
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  progress INTEGER DEFAULT 0,
  score INTEGER,
  summary TEXT,
  usage_stats JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS scoring_jobs_portal_id_idx ON scoring_jobs(portal_id);
CREATE INDEX IF NOT EXISTS scoring_jobs_status_idx ON scoring_jobs(status);
CREATE INDEX IF NOT EXISTS scoring_jobs_created_at_idx ON scoring_jobs(created_at);

-- Add RLS policies
ALTER TABLE scoring_jobs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view their own jobs
CREATE POLICY "Users can view their own jobs" ON scoring_jobs
  FOR SELECT
  USING (auth.uid() = portal_id);

-- Allow service role to manage all jobs
CREATE POLICY "Service role can manage all jobs" ON scoring_jobs
  USING (auth.role() = 'service_role');

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_scoring_jobs_updated_at
  BEFORE UPDATE ON scoring_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 