-- Add log_data column to scoring_events table for storing detailed scoring information
ALTER TABLE scoring_events 
ADD COLUMN IF NOT EXISTS log_data JSONB DEFAULT NULL;

-- Add an index to make queries on logged portal_id more efficient
CREATE INDEX IF NOT EXISTS idx_scoring_events_portal_id ON scoring_events(portal_id);

-- Add comment explaining the purpose of the column
COMMENT ON COLUMN scoring_events.log_data IS 'Stores detailed scoring data including AI inputs/outputs when LOG_PORTAL_ID_SCORE env var is set';

-- Sample queries:

-- To find all scoring events for a specific portal with logs
-- SELECT * FROM scoring_events WHERE portal_id = '123456789' AND log_data IS NOT NULL ORDER BY created_at DESC;

-- To find all scoring events for a specific record
-- SELECT * FROM scoring_events WHERE log_data->>'recordId' = '61119749881' ORDER BY created_at DESC;

-- To find all events where score was above 80
-- SELECT * FROM scoring_events WHERE (log_data->'outputs'->>'score')::numeric > 80 ORDER BY created_at DESC; 