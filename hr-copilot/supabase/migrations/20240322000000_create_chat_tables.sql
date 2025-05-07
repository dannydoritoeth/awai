-- Create conversation sessions table
CREATE TABLE conversation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  summary text,
  CONSTRAINT fk_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Create chat messages table
CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES conversation_sessions(id),
  sender text CHECK (sender IN ('user', 'assistant')),
  message text NOT NULL,
  tool_call jsonb,
  response_data jsonb,
  timestamp timestamptz DEFAULT now(),
  CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES conversation_sessions(id) ON DELETE CASCADE
);

-- Add indexes for common queries
CREATE INDEX idx_conversation_sessions_profile ON conversation_sessions(profile_id);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_timestamp ON chat_messages(timestamp);

-- Add RLS policies
-- ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy for conversation sessions
-- CREATE POLICY "Users can view their own conversation sessions"
--   ON conversation_sessions
--   FOR SELECT
--   USING (auth.uid() = profile_id);

-- CREATE POLICY "Users can create their own conversation sessions"
--   ON conversation_sessions
--   FOR INSERT
--   WITH CHECK (auth.uid() = profile_id);

-- Policy for chat messages
-- CREATE POLICY "Users can view messages in their sessions"
--   ON chat_messages
--   FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM conversation_sessions
--       WHERE conversation_sessions.id = chat_messages.session_id
--       AND conversation_sessions.profile_id = auth.uid()
--     )
--   );

-- CREATE POLICY "Users can insert messages in their sessions"
--   ON chat_messages
--   FOR INSERT
--   WITH CHECK (
--     EXISTS (
--       SELECT 1 FROM conversation_sessions
--       WHERE conversation_sessions.id = chat_messages.session_id
--       AND conversation_sessions.profile_id = auth.uid()
--     )
--   ); 