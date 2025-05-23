-- Create enum for model providers
CREATE TYPE ai_model_provider AS ENUM ('openai', 'google', 'anthropic');

-- Create enum for invocation status
CREATE TYPE ai_invocation_status AS ENUM ('success', 'error', 'timeout');

-- Create table for AI model invocations
CREATE TABLE IF NOT EXISTS public.ai_model_invocations (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id uuid REFERENCES public.conversation_sessions(id),
    action_type text,  -- e.g. 'getDevelopmentPlan'
    model_provider ai_model_provider NOT NULL,
    model_name text NOT NULL,  -- e.g. 'gpt-4', 'gpt-3.5-turbo'
    
    -- Input parameters
    temperature numeric,
    max_tokens integer,
    system_prompt text,
    user_prompt text,
    messages jsonb,  -- Array of message objects
    other_params jsonb,  -- Any additional parameters
    
    -- Response data
    response_text text,
    response_metadata jsonb,  -- Full response data from the API
    token_usage jsonb,  -- Token usage information
    
    -- Metadata
    status ai_invocation_status NOT NULL,
    error_message text,
    latency_ms integer,  -- Response time in milliseconds
    created_at timestamptz NOT NULL DEFAULT now(),
    
    -- Indexes
    CONSTRAINT valid_temperature CHECK (temperature >= 0 AND temperature <= 1)
);

-- Create indexes for common queries
CREATE INDEX idx_ai_invocations_session ON public.ai_model_invocations(session_id);
CREATE INDEX idx_ai_invocations_action ON public.ai_model_invocations(action_type);
CREATE INDEX idx_ai_invocations_status ON public.ai_model_invocations(status);
CREATE INDEX idx_ai_invocations_created ON public.ai_model_invocations(created_at);

-- Add RLS policies
ALTER TABLE public.ai_model_invocations ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Allow read access to authenticated users" 
    ON public.ai_model_invocations
    FOR SELECT 
    TO authenticated 
    USING (true);

-- Allow insert access to service role only
CREATE POLICY "Allow insert access to service role" 
    ON public.ai_model_invocations
    FOR INSERT 
    TO service_role 
    WITH CHECK (true);

-- Grant necessary permissions
GRANT SELECT ON public.ai_model_invocations TO authenticated;
GRANT ALL ON public.ai_model_invocations TO service_role; 