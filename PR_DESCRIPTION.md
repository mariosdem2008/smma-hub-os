# PR Description

## What changed (max 10)
- Wired onboarding to canonical brain ingest and usable flag updates.
- Added strategy draft doc type and updated `match_ai_embeddings` RPC metadata output.
- Implemented RAG retrieval in `ai-ask` with UNKNOWN safety fallbacks.
- Implemented `ai-strategy-generate` with gate + draft generation + citations.
- Added embeddings utilities and real embedding calls when API key is present.
- Logged usage in `ai_usage_logs` across ingest, ask, retrieve, and strategy.
- Added smoke test script for tenant safety + strategy gating.
- Smoke tests now auto-discover agency/client IDs when TEST_* is missing.
- Added docs for implementation, testing, and SQL smoke tests.
- Fixed `match_ai_embeddings` parameter order for Postgres defaults.
- Added expanded `ai_usage_logs` columns for runtime evidence.
- Gated Client Detail access behind `client_brains.usable` with onboarding redirect.
- Added client detail gate tests and return-to onboarding flow.

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
Note: Initial push failed due to parameter default ordering in `match_ai_embeddings`; fixed by reordering parameters.

Local DB status:
```
supabase status -> failed to inspect container health (Docker not running)
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
Example output:
```
Deployed Functions on project dbclmdeowohzmwtkktsa: ai-documents-ingest
```

## Secrets
`OPENAI_API_KEY` is set in Supabase function secrets.

## Smoke Tests
Command: `node docs/ai/brain_spine_smoke_tests.mjs`
Output:
```
Resolved IDs: agency=8cd04a4d-7bac-41f2-845a-af23829f9891, client=851b3c93-ea7d-4d84-aecb-df44743f28e0, other_agency=01be19da-8da8-4686-8c9c-b992f92de25c
1) Insert minimal client brain (missing fields)...
2) Strategy gate returns UNKNOWN...
3) Insert memory doc + embeddings...
4) Retrieval respects agency filter...
5) Update client brain to usable and generate strategy...
Smoke tests passed.
```
Status: PASS

## Quality Gates
- `npm run lint`: OK
- `npx tsc -p .`: OK
- `npm run build`: OK (chunk size warnings only)

## How to test (exact 5 steps)
1) Set env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
2) Run smoke script: `node docs/ai/brain_spine_smoke_tests.mjs`.
3) Create a new client and open `/clients/:id` before onboarding (gate should block).
4) Deep-link `/clients/:id?tab=strategy` before onboarding (gate should still block).
5) Complete AI onboarding (Lock v1) and confirm client detail loads normally.

## Risks + rollback (max 5)
- RLS tightening on brains/embeddings could block direct client reads; rollback by restoring previous policies.
- Strategy draft relies on OPENAI key; without it, UNKNOWN is returned.
- New doc_type check may reject legacy doc_types; rollback by restoring old constraint.
- `match_ai_embeddings` signature change requires callers to use new return shape.
