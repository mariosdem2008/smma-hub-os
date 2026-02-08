# Phase DoD Gates and Rollback Runbooks

## Phase 0 - DoD checklist
- Schema map completed (P0-SCHEMA-01).
- Schema versioning policy defined (P0-SCHEMA-02).
- Eval harness + dataset template created (P0-EVALS-01, P0-EVALS-02).
- Groundedness rubric defined (P0-EVALS-03).
- OTel plan drafted and span storage added (P0-OBS-01..05).
- Shadow Gemini embedding storage and writes enabled (P0-RAG-01).

### Phase 0 merge gates
- `tests/evals/README.md` present.
- `tests/evals/agentic_golden.template.jsonl` present with >= 100 rows (template).
- `tests/evals/workflows/multistep_100.jsonl` present with 100 rows (template).
- `tests/evals/rubrics/` populated with Phase 0 rubrics.
- `docs/ai/schema_registry.json` present.
- All Phase 0 docs updated and ASCII-only.

## Flag matrix (Phase 0)
| Flag | Default | Phase | Notes |
| --- | --- | --- | --- |
| USE_NEW_PLANNER | false | Phase 0 | Planner wiring only; no behavior change when OFF |
| ENABLE_NEW_RAG_INDEXING | true | Phase 0 | Shadow Gemini embedding writes |
| AI_OTEL_LOGGING | true | Phase 0 | OTel span logging to `ai_otel_spans` |
| ENABLE_RAG_RERANKING | false (code) / true (.env.example) | Phase 1 | Reranking behavior flag |
| USE_DURABLE_EXECUTOR | false (code) / true (.env.example) | Phase 1 | Durable executor checkpoints |
| ENFORCE_TOOL_GOVERNANCE | false (code) / true (.env.example) | Phase 1 | Scope/budget/timeout/retries enforcement |
| ENABLE_EPISODIC_MEMORY | false | Phase 2 | Planned |
| ENABLE_LONG_TERM_MEMORY | false | Phase 2 | Planned |
| ENABLE_CONTEXTUAL_INGESTION | false | Phase 2 | Planned |
| RAG_INDEX_PROVIDER | openai | Phase 2 | Cutover switch: openai|gemini (gemini uses ai_embeddings_shadow_gemini_vector) |
| GEMINI_EMBED_DIM_EXPECTED | 768 | Phase 2 | Must match pgvector schema for Gemini retrieval |

### Phase 0 rollback checklist
- Disable any Phase 0 flags (USE_NEW_PLANNER, ENABLE_NEW_RAG_INDEXING, AI_OTEL_LOGGING) if enabled.
- Verification: confirm `AI_RAG_CENTRALIZED` remains OFF in `.env.example` and runtime config.

## Phase 1 - DoD checklist
- Durable executor specs complete (P1-EXEC-01..07).
- Tool contract matrix complete (P1-TOOLS-01..13).
- RAG rerank policy and provenance rules complete (P1-RAG-01..04).
- Provider abstraction test plan complete (P1-INFRA-01, P1-INFRA-02).

### Phase 1 merge gates
- `tests/integration/ai/executor-replay-harness.md` exists.
- `tests/security/tool-scope-negative.test.ts` exists.
- `tests/perf/agentic-load-test.md` exists.
- `scripts/perf/http_load_test.ts` exists (no-deps load test runner).
- Workflow success definition documented in metrics doc.
 - Phase 1 flags enabled in runtime config (USE_DURABLE_EXECUTOR, ENABLE_RAG_RERANKING, ENFORCE_TOOL_GOVERNANCE).

### Phase 1 rollback checklist
- Disable `USE_DURABLE_EXECUTOR`.
- Disable `ENABLE_RAG_RERANKING`.
- Disable `ENFORCE_TOOL_GOVERNANCE`.
- Verification: ensure no Phase 1 features are enabled in runtime config.

## Phase 2 - DoD checklist
- Memory specs complete (P2-MEM-01..03).
- Contextual ingestion + poisoning defense specs complete (P2-RAG-01..03).
- Cutover runbook and decommission checklist complete (P2-CUT-01, P2-CUT-02).
- 7-day validation checklist defined (P2-PERF-01).

### Phase 2 merge gates
- `tests/security/full-tenant-audit.md` exists.
- `tests/perf/7-day-checklist.md` exists.
- `tests/perf/alert-thresholds.md` exists.
- `tests/perf/dashboard-validation.md` exists.
- `tests/integration/cutover/runbook-smoke.md` exists.
- `tests/integration/cutover/decommission-checklist.md` exists.

### Phase 2 rollback checklist
- Commands: see `docs/migrations/agentic-gemini/04_cutover_runbook.md` (Supabase secrets toggles + redeploy).
- Disable `enable_episodic_memory`, `enable_long_term_memory`, `enable_contextual_ingestion`.
- Verification: validate metrics revert to Phase 1 baselines.
