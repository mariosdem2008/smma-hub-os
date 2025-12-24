# How to Test Brain Spine v1

## Prerequisites
- Supabase project with migrations applied.
- Environment variables:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `TEST_AGENCY_ID`
  - `TEST_CLIENT_ID`
  - `TEST_OTHER_AGENCY_ID` (for tenant isolation test)

## Local Steps (6)
1) Apply migrations (including `20251224090000_brain_spine_v1.sql` and `20251224103000_strategy_docs_and_embeddings.sql`).
2) Run SQL smoke tests from `docs/ai/sql_smoke_tests.md`.
3) Run the Node smoke script: `node scripts/brain_spine_smoke_tests.mjs`.
4) In the app, complete Client Onboarding and click "Lock v1".
5) Open the client Strategy tab and click "Generate Strategy".
6) Confirm that you see either UNKNOWN with missing fields or a strategy draft with citations count.

## Remote Verification
- Check `ai_usage_logs` for entries from:
  - `ai-brain-ingest`
  - `ai-ask`
  - `ai-strategy-generate`

## Notes
- If `OPENAI_API_KEY` is missing, the strategy endpoint returns UNKNOWN.
