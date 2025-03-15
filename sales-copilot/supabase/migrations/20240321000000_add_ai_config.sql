-- Add AI configuration columns to hubspot_accounts
ALTER TABLE hubspot_accounts
ADD COLUMN ai_provider text NOT NULL DEFAULT 'openai',
ADD COLUMN ai_model text NOT NULL DEFAULT 'gpt-4-turbo-preview',
ADD COLUMN ai_temperature numeric(3,2) NOT NULL DEFAULT 0.7,
ADD COLUMN ai_max_tokens integer NOT NULL DEFAULT 4000,
ADD COLUMN scoring_prompt text,
ADD COLUMN scoring_prompt_updated_at timestamptz DEFAULT now();

-- Add a check constraint for ai_provider
ALTER TABLE hubspot_accounts
ADD CONSTRAINT valid_ai_provider CHECK (ai_provider IN ('openai', 'anthropic', 'google'));

-- Add a check constraint for temperature range
ALTER TABLE hubspot_accounts
ADD CONSTRAINT valid_temperature CHECK (ai_temperature >= 0 AND ai_temperature <= 1);

-- Add a check constraint for max tokens
ALTER TABLE hubspot_accounts
ADD CONSTRAINT valid_max_tokens CHECK (ai_max_tokens > 0 AND ai_max_tokens <= 32000);

-- Update trigger to maintain scoring_prompt_updated_at
CREATE OR REPLACE FUNCTION update_scoring_prompt_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.scoring_prompt IS DISTINCT FROM OLD.scoring_prompt THEN
        NEW.scoring_prompt_updated_at = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scoring_prompt_timestamp
    BEFORE UPDATE ON hubspot_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_scoring_prompt_timestamp(); 