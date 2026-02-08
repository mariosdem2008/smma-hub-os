# Metrics Operationalization

This document defines computation for all target metrics. All thresholds come from the report.

## Groundedness score (Phase 0 target > 85%)
Definition:
- Score per response = 0.5 * citation_coverage + 0.5 * provenance_match.
- citation_coverage = cited_chunks / retrieved_chunks (cap at 1.0).
- provenance_match = cited_chunks_in_retrieval / cited_chunks (cap at 1.0).
Sample size:
- >= 100 examples from `tests/evals/agentic_golden.template.jsonl` (synthetic template for Phase 0/1; Phase 2 should replace with sampled real prompts).
Pass/Fail:
- Pass if mean score >= 0.85 and no single example < 0.60.
Scripts:
- `tests/evals/rubrics/groundedness_rubric.md` defines scoring rubric and evaluation steps.
- `scripts/evals/run_evals.ts` reads dataset templates (disabled by default).

## Workflow success rate (target >= 95%)
Definition:
- Success if all planned steps complete within retries/timeouts and outputs validate to expected schema.
- Failure if any step exceeds retries, timeout, or schema validation fails.
Evaluation logic:
- Use `tests/evals/workflows/multistep_100.jsonl` with deterministic replay harness.
Sample size:
- 100 workflows minimum.
Pass/Fail:
- Pass if success rate >= 95%.
Scripts:
- Replay harness spec: `tests/integration/ai/executor-replay-harness.md`.
- Replay harness runner: `scripts/evals/replay_executor.ts` (disabled by default).

## EXECUTE schema validity (target >= 99%)
Definition:
- Valid if JSON parses and validates against expected schema.
- Failure categories: parse_error, missing_fields, type_mismatch, constraint_violation.
Sample set:
- Use 100+ EXECUTE outputs from eval dataset.
Pass/Fail:
- Pass if valid_count / total >= 0.99.
Scripts:
- `tests/evals/rubrics/schema_validity_rubric.md` defines rubric and execution spec.
 - Failure categories: parse_error, missing_fields, type_mismatch, constraint_violation.

## p95 latency (target <= 2.5s)
Definition:
- Measure end-to-end request latency at Router entry and final response return.
- Stage-level spans: Router, Planner, Executor, Tools, RAG, Memory, Logging.
Measurement points:
- `src/ai/router.ts` entry/exit, `supabase/functions/*` entry/exit.
Aggregation:
- p95 computed per 15-minute window, grouped by task_type.
Load test tool choice:
- Selected: `scripts/perf/http_load_test.ts` (no dependencies; run in staging with explicit auth headers).
Evidence note:
- A real p95 result requires a valid user JWT (staging) to hit UI endpoints; without a JWT, requests will 401.
Measurement spec:
- `tests/perf/p95_measurement_spec.md`.
Latency budget:
- `tests/perf/latency_budget.md` (p95 sum <= 2.5s).
Evidence (Phase 1):
- `tests/perf/results/2026-02-01_ai-rep-chat_p95.json` shows p95=1305ms (<= 2500ms) at 200 requests, concurrency=10.

## Reranker selection (Phase 1)
Criteria:
- See `tests/evals/reranker-selection.md`.

## RAG shadow vs baseline comparison (Phase 1)
Plan:
- See `tests/evals/rag-shadow-comparison.md`.
Pass/Fail:
- Pass if p95 <= 2.5s in load test and 7-day production checklist.

## 0 cross-tenant leaks
Definition:
- No response or tool result may include data from other tenants.
- Any cross-tenant data exposure is a failure.
Test suites:
- `tests/security/tenant_boundary_fuzz.test.ts`
- `tests/security/rag_poisoning_defense.test.ts`
- Tool/memory tenant scope negative tests: `tests/security/tool-scope-negative.test.ts` (skipped by default).
Negative scenarios:
- Mismatched agency_id/client_id, scope escalation, retrieval across tenants.
Pass/Fail:
- Pass only if all negative tests return access denied and log tenant violation.
