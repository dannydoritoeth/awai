-- Rename scoring_events table to ai_events
ALTER TABLE scoring_events RENAME TO ai_events;

-- Update event_type to include both scoring and training
ALTER TABLE ai_events 
ALTER COLUMN event_type TYPE TEXT,
DROP CONSTRAINT IF EXISTS valid_event_type,
ADD CONSTRAINT valid_event_type CHECK (event_type IN ('score', 'train'));

-- Add new columns for training events
ALTER TABLE ai_events
ADD COLUMN IF NOT EXISTS object_type TEXT,
ADD COLUMN IF NOT EXISTS object_id TEXT,
ADD COLUMN IF NOT EXISTS classification TEXT,
ADD COLUMN IF NOT EXISTS document_data JSONB;

-- Update indexes
DROP INDEX IF EXISTS scoring_events_portal_id_idx;
DROP INDEX IF EXISTS scoring_events_created_at_idx;
DROP INDEX IF EXISTS idx_scoring_events_portal_id;

CREATE INDEX ai_events_portal_id_idx ON ai_events(portal_id);
CREATE INDEX ai_events_created_at_idx ON ai_events(created_at);
CREATE INDEX ai_events_event_type_idx ON ai_events(event_type);
CREATE INDEX ai_events_object_type_idx ON ai_events(object_type);
CREATE INDEX ai_events_classification_idx ON ai_events(classification);

-- Update RLS policies
DROP POLICY IF EXISTS "Users can view their portal's scoring events" ON ai_events;
DROP POLICY IF EXISTS "Service role can manage scoring events" ON ai_events;

CREATE POLICY "Users can view their portal's AI events"
  ON ai_events FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage AI events"
  ON ai_events FOR ALL
  USING (auth.role() = 'service_role');

-- Update function to get current period score count
CREATE OR REPLACE FUNCTION get_current_period_score_count(portal_id_param text)
RETURNS TABLE (
    scores_used bigint,
    period_start timestamp with time zone,
    period_end timestamp with time zone,
    max_scores integer
) LANGUAGE plpgsql AS $$
DECLARE
    sub record;
    scores_used bigint := 0;
    period_start timestamp with time zone;
    period_end timestamp with time zone;
    max_scores integer := 0;
BEGIN
    -- Get current subscription period
    SELECT 
        s.current_period_start,
        s.current_period_end,
        s.plan_tier,
        s.status
    INTO sub
    FROM subscriptions s
    WHERE s.metadata->>'portal_id' = portal_id_param
    AND s.status = 'active'
    ORDER BY s.created_at DESC
    LIMIT 1;

    -- If no active subscription, use fallback
    IF sub IS NULL THEN
        period_start := date_trunc('day', now()) - interval '30 days';
        period_end := date_trunc('day', now()) + interval '1 day';
        max_scores := 50;
    ELSE
        -- Set max scores based on plan tier
        max_scores := CASE
            WHEN sub.plan_tier = 'PRO' THEN 3000
            WHEN sub.plan_tier = 'GROWTH' THEN 7500
            WHEN sub.plan_tier = 'STARTER' THEN 750
            ELSE 50  -- FREE tier or unknown
        END;

        period_start := sub.current_period_start;
        period_end := sub.current_period_end;
    END IF;

    -- Count scores in current period
    SELECT COUNT(*)
    INTO scores_used
    FROM ai_events
    WHERE portal_id = portal_id_param
    AND event_type = 'score'
    AND created_at >= period_start
    AND created_at < period_end;

    RETURN NEXT;
END;
$$; 