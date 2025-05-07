-- Function to match embeddings within a table
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  table_name text
)
RETURNS TABLE (
  id uuid,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT id, 1 - (embedding <=> $1) as similarity
     FROM %I
     WHERE 1 - (embedding <=> $1) > $2
     ORDER BY similarity DESC
     LIMIT $3',
    table_name
  ) USING query_embedding, match_threshold, match_count;
END;
$$;

-- Function to calculate similarity between two entities
CREATE OR REPLACE FUNCTION calculate_embedding_similarity(
  source_id uuid,
  target_id uuid,
  source_table text,
  target_table text
)
RETURNS float
LANGUAGE plpgsql
AS $$
DECLARE
  similarity float;
BEGIN
  EXECUTE format(
    'SELECT 1 - (s.embedding <=> t.embedding) as similarity
     FROM %I s
     JOIN %I t ON true
     WHERE s.id = $1 AND t.id = $2',
    source_table,
    target_table
  ) USING source_id, target_id INTO similarity;
  
  RETURN similarity;
END;
$$;

-- Function to calculate aggregated similarity across related entities
CREATE OR REPLACE FUNCTION calculate_aggregated_similarity(
  source_id uuid,
  related_table text,
  relation_table text,
  source_table text DEFAULT 'profiles'
)
RETURNS float
LANGUAGE plpgsql
AS $$
DECLARE
  avg_similarity float;
BEGIN
  EXECUTE format(
    'WITH related_entities AS (
       SELECT r.id, r.embedding
       FROM %I r
       JOIN %I rel ON rel.%I_id = r.id
       WHERE rel.%I_id = $1
     )
     SELECT AVG(1 - (s.embedding <=> r.embedding)) as avg_similarity
     FROM %I s
     CROSS JOIN related_entities r
     WHERE s.id = $1',
    related_table,
    relation_table,
    substring(related_table from 1 for length(related_table)-1), -- Remove 's' from table name
    substring(source_table from 1 for length(source_table)-1), -- Remove 's' from table name
    source_table
  ) USING source_id INTO avg_similarity;
  
  RETURN COALESCE(avg_similarity, 0);
END;
$$;

-- Add indexes for common embedding operations
CREATE INDEX IF NOT EXISTS idx_profiles_embedding ON profiles USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_roles_embedding ON roles USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_embedding ON jobs USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_companies_embedding ON companies USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_divisions_embedding ON divisions USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_capabilities_embedding ON capabilities USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_skills_embedding ON skills USING ivfflat (embedding vector_cosine_ops); 