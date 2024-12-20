-- Add service role policy
ALTER TABLE generated_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_descriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access" ON generated_descriptions
  USING (true)
  WITH CHECK (true); 