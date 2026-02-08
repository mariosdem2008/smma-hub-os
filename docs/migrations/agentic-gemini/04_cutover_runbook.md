# Cutover Runbook and Readiness Mapping

## Readiness-to-Report Mapping
| Readiness check (report) | Evidence-producing tasks | Evidence artifact |
| --- | --- | --- |
| Schemas versioned and validated in registry | P0-SCHEMA-01, P0-SCHEMA-02, P1-SCHEMA-03 | Schema registry policy + validation specs |
| 12 tools pass integration/security/perf tests | P0-TOOLS-01, P1-TOOLS-02, P1-TOOLS-03, P1-SEC-02 | Tool catalog mapping + security test plan |
| Phase 2 rollback script validated in staging | P2-CUT-01 | Rollback checklist |
| Feature flag system operational across modules | P0-FLAGS-01 | Flag matrix + rollout plan (Phase 2 hardening: explicitly list flags and rollback commands) |
| OpenTelemetry logging integrated, dashboards active | P0-OBS-01, P1-OBS-02, P2-OBS-02 | OTel mapping + dashboard spec |
| RAG groundedness > 85% | P0-EVALS-01, P0-EVALS-02, P1-RAG-03 | Eval harness + dataset |
| Durable executor success >= 95% on 100 cases | P1-EXEC-01, P1-EXEC-02, P1-EVALS-01 | Durable executor spec + workflow eval set |
| Three-tier memory integration tests pass | P0-MEMORY-01, P2-MEM-02, P2-MEM-03 | Memory specs + security gate tests |
| Provider abstraction layer tested with mock | P1-INFRA-01 | Provider abstraction spec |
| Full security audit completed (0 cross-tenant leaks) | P0-SEC-01, P1-SEC-02, P2-SEC-01 | Security audit plan |
| Final performance load tests meet p95 <= 2.5s | P0-PERF-01, P1-PERF-01, P2-PERF-01 | Perf test plan + 7-day checklist |
| Human eval feedback completed and actioned | P2-EVALS-02 | Human eval protocol |

## Pre-cutover (T-7 days)
- Verify 7 consecutive days of metrics meeting: p95 <= 2.5s, success >= 95%, schema >= 99%, 0 cross-tenant leaks.
- Confirm readiness checks above have evidence artifacts in place.
- Ensure feature flags set to allow rollback to Phase 1 within minutes.

## Cutover steps (staging -> production)
Notes:
- Current flags are runtime env flags (global). Phase 2 includes an explicit cohort gate:
  - `PHASE2_COHORT_MODE=require_list` and `PHASE2_COHORT_AGENCY_IDS=<csv>` (prevents accidental global enablement).
  - Set `PHASE2_COHORT_MODE=allow_all` only when intentionally enabling for all tenants.
- Keep "0 cross-tenant leaks" as the primary gate before any expansion.
- Phase 2 RAG cutover uses an explicit provider switch:
  - `RAG_INDEX_PROVIDER=openai|gemini`
  - Gemini vector search requires `GEMINI_EMBED_DIM_EXPECTED=768` and the pgvector table `ai_embeddings_shadow_gemini_vector`.

1) Staging dry run
- Run:
  - `tests/security/full-tenant-audit.md` (subset first, then full)
  - `tests/perf/7-day-checklist.md` (1 day minimum in staging)
  - `tests/integration/cutover/runbook-smoke.md`
  - Phase 2 E2E smoke: `node scripts/smoke/phase2_staging_smoke.mjs`

2) Enable Phase 2 flags (staging)
Example commands (Supabase CLI):
```bash
supabase secrets set ENABLE_EPISODIC_MEMORY=true
supabase secrets set ENABLE_LONG_TERM_MEMORY=true
supabase secrets set ENABLE_CONTEXTUAL_INGESTION=true
supabase secrets set PHASE2_COHORT_MODE=require_list PHASE2_COHORT_AGENCY_IDS=<csv>
supabase functions deploy --project-ref <project_ref>
```

3) RAG provider cutover (staging canary -> staging full)
Tenant safety note: this is not a schema-only change. Keep canary scope tight and validate "0 cross-tenant leaks".
```bash
# Baseline
supabase secrets set RAG_INDEX_PROVIDER=openai

# Gemini cutover (requires ai_embeddings_shadow_gemini_vector populated for target tenants)
supabase secrets set GEMINI_EMBED_DIM_EXPECTED=768
supabase secrets set RAG_INDEX_PROVIDER=gemini
supabase functions deploy --project-ref <project_ref>
```
Verification (staging):
- Run `node scripts/smoke/phase2_staging_smoke.mjs` with `RAG_INDEX_PROVIDER=openai` and again with `RAG_INDEX_PROVIDER=gemini`.
- Evidence artifacts (examples):
  - `tests/integration/cutover/results/2026-02-01_phase2_rag_index_cutover_smoke.json`

4) Production cutover (global)
- Enable the same Phase 2 flags in production.
- Monitor dashboards:
  - Latency, workflow success, schema validity, groundedness, cross-tenant leak count (must be 0).
- Keep a rollback window open until the 7-day checklist completes.

## Rollback steps (Phase 2 emergency rollback)
1) Disable Phase 2 flags
```bash
supabase secrets set ENABLE_EPISODIC_MEMORY=false
supabase secrets set ENABLE_LONG_TERM_MEMORY=false
supabase secrets set ENABLE_CONTEXTUAL_INGESTION=false
supabase secrets set PHASE2_COHORT_MODE=require_list PHASE2_COHORT_AGENCY_IDS=
supabase secrets set RAG_INDEX_PROVIDER=openai
supabase functions deploy --project-ref <project_ref>
```

2) Revert to Phase 1 baseline (if needed)
- Ensure Phase 1 flags are set to the known-good baseline:
  - USE_DURABLE_EXECUTOR=true
  - ENABLE_RAG_RERANKING=true
  - ENFORCE_TOOL_GOVERNANCE=true

3) Verification
- Run a small set of tenant boundary checks (0 cross-tenant leaks).
- Confirm dashboards return to Phase 1 baselines.

## Post-cutover monitoring
- Daily review of groundedness, schema validity, and multi-step success for at least 14 days.
- Confirm no cross-tenant leaks in security monitoring.
- Decommission legacy modules after 14 days stable (per report requirement).
