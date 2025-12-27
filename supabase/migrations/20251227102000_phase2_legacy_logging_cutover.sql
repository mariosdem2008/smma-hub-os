CREATE OR REPLACE FUNCTION prevent_ai_history_writes()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'ai_history is deprecated. Use ai_runs instead. See docs/ai/migration_map_v1.md';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_history_deprecation_trigger ON ai_history;
CREATE TRIGGER ai_history_deprecation_trigger
BEFORE INSERT ON ai_history
FOR EACH ROW EXECUTE FUNCTION prevent_ai_history_writes();

CREATE OR REPLACE FUNCTION prevent_ai_generation_usage_writes()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'ai_generation_usage is deprecated. Use ai_runs instead. See docs/ai/migration_map_v1.md';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_generation_usage_deprecation_trigger ON ai_generation_usage;
CREATE TRIGGER ai_generation_usage_deprecation_trigger
BEFORE INSERT ON ai_generation_usage
FOR EACH ROW EXECUTE FUNCTION prevent_ai_generation_usage_writes();

CREATE OR REPLACE VIEW ai_history_from_runs_v AS
SELECT
  id,
  agency_id,
  client_id,
  created_at,
  metadata->'input' AS input,
  metadata->'output' AS output,
  metadata->>'mode' AS mode,
  NULLIF(metadata->>'project_id', '')::uuid AS project_id
FROM ai_runs
WHERE metadata->>'legacy_source' = 'generate-ai-content';

CREATE OR REPLACE VIEW ai_generation_usage_from_runs_v AS
SELECT
  id,
  user_id,
  agency_id,
  metadata->>'mode' AS generation_type,
  to_char(created_at, 'YYYY-MM') AS month_year,
  created_at
FROM ai_runs
WHERE metadata->>'legacy_source' = 'generate-ai-content';
