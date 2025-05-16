-- Drop existing foreign key constraints
ALTER TABLE conversation_sessions
DROP CONSTRAINT IF EXISTS fk_entity_profile,
DROP CONSTRAINT IF EXISTS fk_entity_role,
DROP CONSTRAINT IF EXISTS check_entity_id_required;

