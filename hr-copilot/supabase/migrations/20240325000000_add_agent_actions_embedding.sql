-- Add embedding column to agent_actions
ALTER TABLE agent_actions ADD COLUMN embedding vector(1536);

-- Create index for similarity search
CREATE INDEX ON agent_actions USING ivfflat (embedding vector_cosine_ops);

-- Grant necessary permissions
GRANT ALL ON TABLE agent_actions TO postgres, anon, authenticated, service_role; 