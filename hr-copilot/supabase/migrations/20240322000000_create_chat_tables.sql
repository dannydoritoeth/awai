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


-- Add mode and entity_id columns to conversation_sessions
ALTER TABLE conversation_sessions
ADD COLUMN mode text CHECK (mode IN ('candidate', 'hiring', 'general')),
ADD COLUMN entity_id uuid,
ADD COLUMN status text DEFAULT 'active';

-- Add index for common queries
CREATE INDEX idx_conversation_sessions_mode ON conversation_sessions(mode);
CREATE INDEX idx_conversation_sessions_entity ON conversation_sessions(entity_id);

-- Add foreign key constraints
ALTER TABLE conversation_sessions
ADD CONSTRAINT fk_entity_profile FOREIGN KEY (entity_id) REFERENCES profiles(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_entity_role FOREIGN KEY (entity_id) REFERENCES roles(id) ON DELETE CASCADE; 



-- Drop existing foreign key constraints
ALTER TABLE conversation_sessions
DROP CONSTRAINT IF EXISTS fk_entity_profile,
DROP CONSTRAINT IF EXISTS fk_entity_role;

-- Add new foreign key constraints that allow NULL values
ALTER TABLE conversation_sessions
ADD CONSTRAINT fk_entity_profile 
  FOREIGN KEY (entity_id) 
  REFERENCES profiles(id) 
  ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED,
ADD CONSTRAINT fk_entity_role
  FOREIGN KEY (entity_id) 
  REFERENCES roles(id) 
  ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

-- Add check constraint to ensure entity_id is required for non-general modes
ALTER TABLE conversation_sessions
ADD CONSTRAINT check_entity_id_required
  CHECK (
    (mode = 'general' AND entity_id IS NULL) OR
    (mode != 'general' AND entity_id IS NOT NULL)
  ); 


-- Drop existing foreign key constraints
ALTER TABLE conversation_sessions
DROP CONSTRAINT IF EXISTS fk_entity_profile,
DROP CONSTRAINT IF EXISTS fk_entity_role;

-- Add conditional foreign key constraints based on mode
-- ALTER TABLE conversation_sessions
-- ADD CONSTRAINT check_entity_references
--   CHECK (
--     (mode = 'candidate' AND EXISTS (SELECT 1 FROM profiles WHERE id = entity_id)) OR
--     (mode = 'hiring' AND EXISTS (SELECT 1 FROM roles WHERE id = entity_id)) OR
--     (mode = 'general' AND entity_id IS NULL)
--   );

-- Add indexes to improve performance
-- CREATE INDEX idx_conversation_sessions_entity_mode ON conversation_sessions(entity_id, mode); 


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