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