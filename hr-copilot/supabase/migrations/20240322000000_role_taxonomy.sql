-- Create taxonomy table
CREATE TABLE IF NOT EXISTS taxonomy (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  taxonomy_type text DEFAULT 'core',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create role_taxonomies table
CREATE TABLE IF NOT EXISTS role_taxonomies (
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  taxonomy_id uuid REFERENCES taxonomy(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (role_id, taxonomy_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_taxonomy_name ON taxonomy(name);
CREATE INDEX IF NOT EXISTS idx_taxonomy_type ON taxonomy(taxonomy_type);
CREATE INDEX IF NOT EXISTS idx_role_taxonomies_role_id ON role_taxonomies(role_id);
CREATE INDEX IF NOT EXISTS idx_role_taxonomies_taxonomy_id ON role_taxonomies(taxonomy_id);

-- Add missing created_at column to agent_actions if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'agent_actions' 
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE agent_actions ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Add execute_sql function for dynamic SQL queries
CREATE OR REPLACE FUNCTION execute_sql(sql text, params jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Security checks
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles 
    WHERE rolname = current_user 
    AND rolsuper
  ) THEN
    -- Only allow SELECT queries
    IF NOT (lower(sql) LIKE 'select%') THEN
      RAISE EXCEPTION 'Only SELECT queries are allowed';
    END IF;

    -- Prevent writes
    IF lower(sql) LIKE '%insert%' OR 
       lower(sql) LIKE '%update%' OR 
       lower(sql) LIKE '%delete%' OR 
       lower(sql) LIKE '%drop%' OR 
       lower(sql) LIKE '%truncate%' OR 
       lower(sql) LIKE '%alter%' THEN
      RAISE EXCEPTION 'Write operations are not allowed';
    END IF;
  END IF;

  -- Execute the query with parameters
  EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', sql) 
  USING params
  INTO result;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$; 