-- Add browser_session_id column to conversation_sessions
ALTER TABLE conversation_sessions
ADD COLUMN browser_session_id text;

-- Add index for browser_session_id
CREATE INDEX idx_conversation_sessions_browser_session ON conversation_sessions(browser_session_id);

-- Modify profile_id to be nullable since we'll support anonymous users
ALTER TABLE conversation_sessions
ALTER COLUMN profile_id DROP NOT NULL;

-- Add RLS policies for anonymous access
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy for conversation sessions - allow access based on browser_session_id or profile_id
CREATE POLICY "Users can view their conversation sessions"
  ON conversation_sessions
  FOR SELECT
  USING (
    browser_session_id IS NOT NULL OR 
    (auth.uid() IS NOT NULL AND profile_id = auth.uid())
  );

CREATE POLICY "Users can create conversation sessions"
  ON conversation_sessions
  FOR INSERT
  WITH CHECK (
    browser_session_id IS NOT NULL OR 
    (auth.uid() IS NOT NULL AND profile_id = auth.uid())
  );

-- Policy for chat messages - allow access to messages in accessible sessions
CREATE POLICY "Users can view messages in their browser sessions"
  ON chat_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_sessions
      WHERE conversation_sessions.id = chat_messages.session_id
      AND (
        conversation_sessions.browser_session_id IS NOT NULL OR
        (auth.uid() IS NOT NULL AND conversation_sessions.profile_id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can create messages in their browser sessions"
  ON chat_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_sessions
      WHERE conversation_sessions.id = chat_messages.session_id
      AND (
        conversation_sessions.browser_session_id IS NOT NULL OR
        (auth.uid() IS NOT NULL AND conversation_sessions.profile_id = auth.uid())
      )
    )
  ); 