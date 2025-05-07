-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS match_embeddings(vector(1536), float, int, text);
DROP FUNCTION IF EXISTS match_embeddings_by_id(uuid, text, float, int);
DROP FUNCTION IF EXISTS match_embeddings_by_vector(vector(1536), text, float, int);

-- Function to match embeddings by ID
CREATE OR REPLACE FUNCTION match_embeddings_by_id(
  p_query_id uuid,
  p_table_name text,
  p_match_threshold float,
  p_match_count int
)
RETURNS TABLE (
  id uuid,
  similarity float,
  name text,
  title text
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_embedding vector(1536);
BEGIN
  -- Get the embedding for the query ID
  EXECUTE format(
    'SELECT embedding FROM %I WHERE id = $1',
    p_table_name
  ) USING p_query_id INTO query_embedding;

  IF query_embedding IS NULL THEN
    RAISE EXCEPTION 'No embedding found for ID % in table %', p_query_id, p_table_name;
  END IF;

  -- Use the embedding to find matches
  RETURN QUERY EXECUTE format(
    'SELECT id, 1 - (embedding <=> $1) as similarity, name, title
     FROM %I
     WHERE id != $2 AND 1 - (embedding <=> $1) > $3
     ORDER BY similarity DESC
     LIMIT $4',
    p_table_name
  ) USING query_embedding, p_query_id, p_match_threshold, p_match_count;
END;
$$;

-- Function to match embeddings by vector
CREATE OR REPLACE FUNCTION match_embeddings_by_vector(
  p_query_embedding vector(1536),
  p_table_name text,
  p_match_threshold float,
  p_match_count int
)
RETURNS TABLE (
  id uuid,
  similarity float,
  name text,
  title text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT id, 1 - (embedding <=> $1) as similarity, name, title
     FROM %I
     WHERE 1 - (embedding <=> $1) > $2
     ORDER BY similarity DESC
     LIMIT $3',
    p_table_name
  ) USING p_query_embedding, p_match_threshold, p_match_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION match_embeddings_by_id TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION match_embeddings_by_vector TO postgres, anon, authenticated, service_role; 