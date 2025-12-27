ALTER TABLE ai_runs
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
