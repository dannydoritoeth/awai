-- First drop all existing policies
DROP POLICY IF EXISTS "owners can create descriptions" ON generated_descriptions;
DROP POLICY IF EXISTS "owners can view their descriptions" ON generated_descriptions;
DROP POLICY IF EXISTS "Service role has full access" ON generated_descriptions;
DROP POLICY IF EXISTS "Users can delete their own generated descriptions" ON generated_descriptions;
DROP POLICY IF EXISTS "Users can insert their own generated descriptions" ON generated_descriptions;
DROP POLICY IF EXISTS "Users can update their own generated descriptions" ON generated_descriptions;
DROP POLICY IF EXISTS "Users can view their own generated descriptions" ON generated_descriptions;

-- Enable RLS
ALTER TABLE generated_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_descriptions FORCE ROW LEVEL SECURITY;

-- Create new policies
CREATE POLICY "owners can create descriptions" ON generated_descriptions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
      AND listings.user_id = auth.uid()
    )
  );

CREATE POLICY "owners can view their descriptions" ON generated_descriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
      AND listings.user_id = auth.uid()
    )
  );

CREATE POLICY "owners can update their descriptions" ON generated_descriptions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
      AND listings.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
      AND listings.user_id = auth.uid()
    )
  );

CREATE POLICY "owners can delete their descriptions" ON generated_descriptions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
      AND listings.user_id = auth.uid()
    )
  ); 