# Testing and Evaluation Plan

## Evaluation harness structure
- Dataset location (current template): `tests/evals/agentic_golden.template.jsonl`
- Workflow dataset: `tests/evals/workflows/multistep_100.jsonl` (Phase 1 minimum 100 rows)
- Intent classification dataset template: `tests/evals/intent_classification_50.template.jsonl`
 - Harness stub: `scripts/evals/run_evals.ts` (disabled by default via AI_EVALS_ENABLED)
- Format (JSONL):
  - query
  - mode_expected (CHAT|EXECUTE)
  - golden_sources (array of doc IDs or citations)
- expected_schema (IntentResultSchema | PlanSchema_v1 | StrategyPlanSchema | etc.)
- rubric (scoring criteria)
- Minimum dataset size: 100+ golden questions (Phase 0/1 uses a synthetic template; Phase 2 should replace with sampled real prompts)

## Metrics and computation
- Groundedness score target > 85% (Phase 0) using citation coverage and provenance match
- Multi-step workflow success >= 95% on 100 cases (Phase 1)
- Schema validity >= 99% on EXECUTE outputs (Phase 2)
- p95 latency <= 2.5s (load test plan)
- 0 cross-tenant leaks (security test suite + negative tests)

## Test suites (explicit)
### Unit tests
- Schema validation: IntentResultSchema, PlanSchema_v1, ToolCall/ToolResult, RetrievalResult, MemoryWriteProposal, StrategyPlanSchema
- Tool registry enforcement (scope/budget/timeout/retries/idempotency)
- Router intent classification logic

### Integration tests
- RAG retrieval scoping per tenant + provenance
- Tool call execution in durable executor
- Checkpoint pause/resume and recovery paths

### Security tests
- Tenant boundary fuzz tests for all RAG and memory read paths (0 cross-tenant leaks)
- Provenance enforcement tests (retrieved docs must match tenant scope)
- Poisoning defense (manifest validation blocks unknown sources)

### Performance tests
- Latency budget by stage (Router/Planner/Executor/Tools/RAG/Memory/Logging)
- p95 measurement method: capture per-stage timings, aggregate per request

### Evals
- Offline eval: run dataset through new pipeline in shadow mode
- Shadow mode: compare old vs new outputs without user exposure

## Evaluation harness notes
- Use `src/ai/router.ts` as canonical entry for LLM calls (current behavior)
- Keep new RAG indexing in shadow mode in Phase 0
- Ensure metrics are logged per request and per stage (OpenTelemetry plan)

## How to run (local)
```bash
AI_EVALS_ENABLED=true node scripts/evals/run_evals.ts
AI_EVALS_ENABLED=true node scripts/evals/replay_executor.ts
```
