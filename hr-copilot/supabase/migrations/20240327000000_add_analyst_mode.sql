-- Add 'analyst' to allowed values in conversation_sessions.mode check constraint
ALTER TABLE conversation_sessions
DROP CONSTRAINT IF EXISTS conversation_sessions_mode_check;

ALTER TABLE conversation_sessions
ADD CONSTRAINT conversation_sessions_mode_check 
CHECK (mode IN ('candidate', 'hiring', 'general', 'analyst'));

-- Update chatTypes.ts type definition
COMMENT ON COLUMN conversation_sessions.mode IS 'Valid values: candidate, hiring, general, analyst'; 