
-- Add new columns for request tracking
ALTER TABLE public.agent_actions 
  ADD COLUMN request jsonb,
  ADD COLUMN response jsonb,
  ADD COLUMN request_hash text,
  ADD COLUMN step_index integer;

-- Create index on request_hash for faster lookups
CREATE INDEX idx_agent_actions_request_hash ON public.agent_actions(request_hash);

-- Create index on session_id and step_index for ordered retrieval
CREATE INDEX idx_agent_actions_session_step ON public.agent_actions(session_id, step_index);

-- Grant necessary permissions
GRANT ALL ON TABLE agent_actions TO postgres, anon, authenticated, service_role; 