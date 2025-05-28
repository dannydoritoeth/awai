-- Create institutions table
CREATE TABLE institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                         -- Display name: e.g. "NSW Government"
  slug TEXT UNIQUE NOT NULL,                  -- URL-safe identifier: e.g. "nsw-gov"
  description TEXT,                           -- Optional blurb about the institution
  logo_url TEXT,                              -- Optional logo or badge
  website_url TEXT,                           -- Optional public site
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add institution_id to companies
ALTER TABLE companies
ADD COLUMN institution_id UUID REFERENCES institutions(id);

-- Create index for faster lookups
CREATE INDEX idx_companies_institution_id ON companies(institution_id);

-- Add RLS policies
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;

-- Allow public read access to institutions
CREATE POLICY "Allow public read access to institutions"
  ON institutions
  FOR SELECT
  USING (true);

-- Only allow authenticated users to modify institutions
CREATE POLICY "Allow authenticated users to modify institutions"
  ON institutions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON institutions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at(); 