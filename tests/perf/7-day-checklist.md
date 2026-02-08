# 7-Day Production Validation Checklist (Phase 2 Gate)

Goal: verify stability before and during Phase 2 cutover.

Non-negotiables
- 0 cross-tenant leaks (must remain 0)
- p95 latency <= 2500ms
- workflow success rate >= 95%
- EXECUTE schema validity >= 99%
- groundedness >= 85%

Daily checklist (Days 1-7)
1) Load test (staging or production safe tenant)
- Run: `node scripts/perf/http_load_test.ts` against an allowlisted endpoint with a valid user JWT.
- Record output JSON under `tests/perf/results/YYYY-MM-DD_<endpoint>_p95.json`.

2) Workflow replay harness
- Run:
  - `AI_EVALS_ENABLED=true node scripts/evals/run_evals.ts`
  - `AI_EVALS_ENABLED=true node scripts/evals/replay_executor.ts`
- Record outputs (counts + pass/fail).

3) Tenant safety spot check
- Run a small subset of negative cases from `tests/security/full-tenant-audit.md`.
- Confirm denials (tenant_scope_violation) and no leaked data.

4) OTel spans and logs present
- Confirm new spans exist in `ai_otel_spans` for the tested agency_id.
- Confirm p95 from spans and p95 from load runner are consistent directionally.

5) Regression scan
- Check for:
  - spike in UNKNOWN responses
  - error rate / 5xx rate changes
  - retries/timeouts increasing

Exit criteria
- All 7 days pass all non-negotiables.
- Any single-day failure triggers rollback to Phase 1 and blocks Phase 2 expansion.

