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
- Fixed `match_ai_embeddings` parameter order for Postgres defaults.
- Added expanded `ai_usage_logs` columns for runtime evidence.

## Push/Upstream
Command: `git push -u origin feat/ai-employee-v1-sprint1-2025-12-23`
Output:
```
branch 'feat/ai-employee-v1-sprint1-2025-12-23' set up to track 'origin/feat/ai-employee-v1-sprint1-2025-12-23'.
To https://github.com/mariosdem2008/smma-hub-os.git
 * [new branch]      feat/ai-employee-v1-sprint1-2025-12-23 -> feat/ai-employee-v1-sprint1-2025-12-23
```

## Migration Order + Verification
Applied in order:
1) `20251224090000_brain_spine_v1.sql`
2) `20251224103000_strategy_docs_and_embeddings.sql`
3) `20251224110000_expand_ai_usage_logs.sql`

Command: `supabase db push`
Output:
```
Applying migration 20251224090000_brain_spine_v1.sql...
Applying migration 20251224103000_strategy_docs_and_embeddings.sql...
Applying migration 20251224110000_expand_ai_usage_logs.sql...
Finished supabase db push.
```

Verification queries (remote):
- Q1: `client_brains.usable` exists
- Q2: `match_ai_embeddings` exists
- Q3: `ai_usage_logs` has new columns

Status: PENDING (CLI has no remote query command and no DB URL configured locally). Run in Supabase SQL editor and record results in `docs/ai/sql_smoke_tests.md`.

## Functions Deployed
Commands:
- `supabase functions deploy ai-documents-ingest`
- `supabase functions deploy ai-ask`
- `supabase functions deploy ai-brain-ingest`
- `supabase functions deploy ai-strategy-generate`
- `supabase functions deploy ai-retrieve-context`

Each returned `Deployed Functions` for project `dbclmdeowohzmwtkktsa`.

## Secrets
`OPENAI_API_KEY` not present in `supabase/.env`.
TODO added in `docs/ai/spec_gaps.md`.

## Smoke Tests
Command: `node scripts/brain_spine_smoke_tests.mjs`
Output:
```
Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEST_AGENCY_ID, TEST_CLIENT_ID, TEST_OTHER_AGENCY_ID
```
Status: BLOCKED (missing test IDs). Provide `TEST_*` IDs to rerun.

## Quality Gates
- `npm run lint`: OK
- `npx tsc -p .`: OK
- `npm run build`: OK (chunk size warnings only)

## How to test (exact 6 steps)
1) Apply migrations in order (see above).
2) Run SQL checks from `docs/ai/sql_smoke_tests.md` in Supabase SQL editor.
3) Set env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TEST_AGENCY_ID`, `TEST_CLIENT_ID`, `TEST_OTHER_AGENCY_ID`.
4) Run smoke script: `node scripts/brain_spine_smoke_tests.mjs`.
5) In-app: complete client onboarding and click "Lock v1".
6) Open Strategy Hub and click "Generate Strategy" to see UNKNOWN or a draft with citations.

## Risks + rollback (max 5)
- RLS tightening on brains/embeddings could block direct client reads; rollback by restoring previous policies.
- Strategy draft relies on OPENAI key; without it, UNKNOWN is returned.
- New doc_type check may reject legacy doc_types; rollback by restoring old constraint.
- `match_ai_embeddings` signature change requires callers to use new return shape.
