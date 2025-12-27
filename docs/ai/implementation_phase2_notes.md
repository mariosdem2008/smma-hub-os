# Phase 2 Implementation Notes

## Tasks completed (Phase 2)
- AI-006: Provider timeout/retry utilities + circuit breaker (feature flagged)
- AI-007: OpenAI provider timeout/retry/circuit-breaker wrapping
- AI-008: Anthropic provider timeout/retry/circuit-breaker wrapping
- AI-009: Embedding fail-hard with zero-vector tagging (feature flagged)
- AI-010: Provider reliability + embedding hardening tests
- Phase 2 deltas: ai_runs.metadata, cost estimation method indicator, legacy logging cutover views/triggers

## Files changed
- src/ai/providers/utils.ts
- src/ai/providers/openai.ts
- src/ai/providers/anthropic.ts
- src/ai/providers/types.ts
- src/ai/router.ts
- src/ai/providers/__tests__/utils.test.ts
- tests/integration/ai/circuit-breaker.test.ts
- supabase/functions/_shared/embedding-policy.ts
- supabase/functions/ai-documents-ingest/index.ts
- supabase/functions/ai-brain-ingest/index.ts
- supabase/functions/ai-strategy-generate/index.ts
- tests/integration/ai/embedding-fail-hard.test.ts
- supabase/migrations/20251227101000_add_ai_runs_metadata.sql
- supabase/migrations/20251227102000_phase2_legacy_logging_cutover.sql
- supabase/functions/ai-ask/index.ts
- supabase/functions/generate-ai-content/index.ts

## Behavior changes
- Provider fetch calls are wrapped with timeout/retry and circuit breaker when flags are enabled.
- Timeouts default to 30s for non-embed tasks; router passes task-specific timeouts (10s embed, 45s summarize, 60s strategy/client portal QA).
- Circuit breaker opens on >=50% failures in a 5-minute window; half-open probes every 30s.
- Embedding endpoints can fail hard (500 with code) when `AI_EMBEDDING_FAIL_HARD=true`; otherwise zero-vector fallback remains but is tagged.
- Canonical ai_runs now include `metadata.cost_estimation_method`.
- generate-ai-content no longer writes legacy tables unless `AI_LEGACY_LOGGING=true`.
- Legacy write triggers added for `ai_history` and `ai_generation_usage` and compat views added (`ai_history_from_runs_v`, `ai_generation_usage_from_runs_v`).

## Flags and defaults
- AI_PROVIDER_TIMEOUTS=false
- AI_PROVIDER_RETRIES=unset (defaults to AI_PROVIDER_TIMEOUTS when unset)
- AI_CIRCUIT_BREAKER=false
- AI_EMBEDDING_FAIL_HARD=false
- AI_LEGACY_LOGGING=false

## Rollback
1) Disable provider reliability: set `AI_PROVIDER_TIMEOUTS=false` (and optionally `AI_PROVIDER_RETRIES=false`).
2) Disable circuit breaker: set `AI_CIRCUIT_BREAKER=false`.
3) Restore legacy logging: set `AI_LEGACY_LOGGING=true`.
4) Allow zero-vector fallback: set `AI_EMBEDDING_FAIL_HARD=false`.
5) If needed, rollback DB migrations:
   - Drop triggers/views from `20251227102000_phase2_legacy_logging_cutover.sql`.
   - Drop `ai_runs.metadata` column added by `20251227101000_add_ai_runs_metadata.sql`.

## How to test
```bash
npm run test
npm run lint
npx tsc -p .
npm run build
```

## SQL validation
```sql
-- Confirm ai_runs metadata column exists
SELECT column_name FROM information_schema.columns
WHERE table_name = 'ai_runs' AND column_name = 'metadata';

-- Confirm no new writes to legacy tables (expect errors if writes attempted)
-- (Tested by attempting a manual insert)

-- Verify compat views exist
SELECT * FROM ai_history_from_runs_v LIMIT 1;
SELECT * FROM ai_generation_usage_from_runs_v LIMIT 1;

-- Pre-step: flag existing zero-vector embeddings before enabling fail-hard
UPDATE ai_embeddings
SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{legacy_zero_vector}', 'true')
WHERE embedding = array_fill(0, ARRAY[1536]);
```
