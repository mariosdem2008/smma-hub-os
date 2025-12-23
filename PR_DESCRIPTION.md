# PR Description

## What changed (max 10)
- Wired onboarding to canonical brain ingest and usable flag updates.
- Added strategy draft doc type and updated `match_ai_embeddings` RPC metadata output.
- Implemented RAG retrieval in `ai-ask` with UNKNOWN safety fallbacks.
- Implemented `ai-strategy-generate` with gate + draft generation + citations.
- Added embeddings utilities and real embedding calls when API key is present.
- Logged usage in `ai_usage_logs` across ingest, ask, retrieve, and strategy.
- Added smoke test script for tenant safety + strategy gating.
- Added docs for implementation, testing, and SQL smoke tests.

## How to test (6 steps)
1) Apply migrations: `20251224090000_brain_spine_v1.sql`, `20251224103000_strategy_docs_and_embeddings.sql`, `20251224110000_expand_ai_usage_logs.sql`.
2) Run SQL checks in `docs/ai/sql_smoke_tests.md`.
3) Set env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TEST_AGENCY_ID`, `TEST_CLIENT_ID`, `TEST_OTHER_AGENCY_ID`.
4) Run smoke script: `node scripts/brain_spine_smoke_tests.mjs`.
5) In-app: complete client onboarding and click "Lock v1".
6) Open Strategy Hub and click "Generate Strategy" to see UNKNOWN or a draft with citations.

## Risks + rollbacks (max 5)
- RLS tightening on brains/embeddings could block any direct client reads; rollback by restoring previous policies.
- Strategy draft relies on OpenAI key; without it, UNKNOWN is returned.
- New doc_type check may reject unexpected legacy doc_types; rollback by restoring old constraint.
- match_ai_embeddings signature changes require any callers to use new return shape.
