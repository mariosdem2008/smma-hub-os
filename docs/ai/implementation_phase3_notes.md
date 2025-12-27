# Phase 3 Implementation Notes

## Scope delivered
- AI-011: Centralized RAG policy module and unit tests.
- AI-012: ai-ask uses ragPolicy when AI_RAG_CENTRALIZED enables rollout.
- AI-013: ai-strategy-generate uses ragPolicy when AI_RAG_CENTRALIZED enables rollout.
- AI-014: Freeform tasks require freeformReason (type enforcement + test).
- AI-016: RAG correctness integration tests (retrieval count, citations subset, context truncation).

## Flags and defaults
- AI_RAG_CENTRALIZED=false
- AI_SCHEMA_STRICT=false
- AI_ADMIN_CHAT_SCHEMA=false (unused in Phase 3)

## Rollout instructions
1) Deploy with flags OFF.
2) A/B rollout:
   - `AI_RAG_CENTRALIZED=10` (10% of client_id/agency_id hash buckets)
   - `AI_RAG_CENTRALIZED=50` (50% rollout)
   - `AI_RAG_CENTRALIZED=true` or `100` (full rollout)
3) If issues: set `AI_RAG_CENTRALIZED=false` to revert to legacy RAG config.

## Behavior changes
- Centralized RAG config via `src/ai/ragPolicy.ts` when enabled.
- RAG metadata captured in ai_runs metadata:
  - `retrieval_count`
  - `context_truncated`
  - `doc_types_used`
  - `rag_policy_version` ("v1" when enabled, "legacy" otherwise)
- Citations are validated via `src/ai/citations.ts`.
- When AI_SCHEMA_STRICT=false, citation errors are logged to `metadata.citation_errors`.
- When AI_SCHEMA_STRICT=true, invalid citations return 500 with code `CITATION_VALIDATION_FAILED`.

## How to measure quality (from migration_map_v1.md)
```sql
-- Citation coverage (>=1 memory citation or brain field)
SELECT
  COUNT(*) FILTER (
    WHERE (
      jsonb_array_length(COALESCE(citations->'memory_citations','[]'::jsonb)) > 0
      OR jsonb_array_length(COALESCE(citations->'client_brain_fields','[]'::jsonb)) > 0
      OR jsonb_array_length(COALESCE(citations->'agency_brain_fields','[]'::jsonb)) > 0
    )
  )::float / NULLIF(COUNT(*), 0) AS citation_coverage
FROM ai_runs
WHERE created_at >= now() - interval '7 days'
  AND metadata->>'rag_policy_version' = 'v1';

-- Unknown rate
SELECT
  COUNT(*) FILTER (WHERE unknown = true)::float / NULLIF(COUNT(*), 0) AS unknown_rate
FROM ai_runs
WHERE created_at >= now() - interval '7 days'
  AND metadata->>'rag_policy_version' = 'v1';

-- Escalation rate
SELECT
  COUNT(*) FILTER (WHERE escalate_to_human = true)::float / NULLIF(COUNT(*), 0) AS escalation_rate
FROM ai_runs
WHERE created_at >= now() - interval '7 days'
  AND metadata->>'rag_policy_version' = 'v1';
```

## Rollback steps
1) Set `AI_RAG_CENTRALIZED=false` to revert to legacy RAG config.
2) Set `AI_SCHEMA_STRICT=false` to disable hard-fail citation validation.
3) Revert code changes in:
   - `src/ai/ragPolicy.ts`
   - `supabase/functions/ai-ask/index.ts`
   - `supabase/functions/ai-strategy-generate/index.ts`
   - `src/ai/citations.ts`
   - `src/ai/taskRegistry.ts`

## Tests
```bash
npm run test
npm run lint
npx tsc -p .
npm run build
```
