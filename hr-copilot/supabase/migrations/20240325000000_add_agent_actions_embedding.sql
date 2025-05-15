-- Add embedding column to agent_actions
ALTER TABLE agent_actions ADD COLUMN embedding vector(1536);

-- Create index for similarity search
CREATE INDEX ON agent_actions USING ivfflat (embedding vector_cosine_ops);

-- Grant necessary permissions
GRANT ALL ON TABLE agent_actions TO postgres, anon, authenticated, service_role; 


-- Policy for service role to bypass RLS
ALTER TABLE conversation_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to conversation sessions"
  ON conversation_sessions
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');


  -- Grant permissions to service role
GRANT ALL ON conversation_sessions TO service_role;
GRANT ALL ON chat_messages TO service_role;