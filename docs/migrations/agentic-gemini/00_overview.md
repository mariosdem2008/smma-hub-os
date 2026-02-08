# Agentic Gemini Migration Program V2 (Phase 0 Complete + Phase 1 Implemented + Phase 2 Prep)

This V2 package expands the migration plan with higher granularity, explicit tests, and measurable acceptance criteria. Phase 0 deliverables are implemented (schemas, flags, shadow embeddings, OTel spans). Phase 1 behaviors are implemented behind flags. Phase 2 is prepared via explicit checklists and runbooks.

## Executive summary (25 lines)
1) Targets (report): p95 latency <= 2.5s.
2) Targets (report): workflow success rate >= 95%.
3) Targets (report): EXECUTE schema validity >= 99%.
4) Targets (report): cross-tenant data leaks = 0.
5) Phase 0 delivers schemas, planner/intent specs, eval harness, shadow Gemini embeddings, and OTel plan.
6) Phase 1 delivers durable execution specs, tool governance, and Phase 1 RAG (retrieve + rerank).
7) Phase 2 activates tiered memory, contextual ingestion, and cutover controls.
8) Every phase ships behind flags with explicit rollback steps.
9) All tasks are dependency-ordered and measurable.
10) Security requirements explicitly enforce tenant scoping and 0 cross-tenant leaks.
11) Groundedness is measured via citation and provenance coverage against gold datasets.
12) Workflow success is measured via deterministic replay in eval harness.
13) Schema validity is enforced at EXECUTE outputs with failure categorization.
14) p95 latency is measured by stage budgets with load tests.
15) OTel spans cover Router, Planner, Executor, Tools, RAG, Memory, Logging.
16) Supabase Edge functions are the primary runtime for agentic operations.
17) src/ai/router.ts remains canonical LLM entrypoint.
18) Gemini-first is preserved with provider abstraction for fallbacks.
19) Shadow indexing minimizes risk before RAG cutover.
20) Memory writes require approval for sensitive facts.
21) Tool governance enforces scope, timeout, retries, idempotency, and budgets.
22) Readiness checks from the report are mapped to concrete evidence artifacts.
23) UNKNOWNs are labeled and tracked with resolution tasks.
24) No production modules are refactored in this phase.
25) Deliverables are planning artifacts, dataset templates, and test stubs only.

## Phase 0 implementation status (as of 2026-02-01)
- Planner task type, prompts, and router wiring added (`src/ai/planner.ts`, `src/ai/prompts/planner.ts`, `src/ai/taskTypes.ts`).
- Intent output and plan/tool/retrieval/memory/strategy schemas expanded (`src/ai/schema.ts`).
- Flags and defaults set for shadow Gemini embeddings and OTel span logging (`src/ai/flags.ts`, `.env.example`).
- OTel span stub and router logging to `ai_otel_spans` added (`src/ai/otel.ts`, `src/ai/router.ts`).
- Shadow Gemini embedding writes enabled in ingest paths (`supabase/functions/*`, `supabase/functions/_shared/*`).
- Migration stubs added (`supabase/migrations/20260201000000_add_ai_shadow_gemini_embeddings.sql`, `supabase/migrations/20260201001000_add_ai_otel_spans.sql`).
- Eval/test and schema registry artifacts added (`tests/evals/*`, `tests/perf/*`, `tests/security/*`, `docs/ai/schema_registry.json`).

## Schema map (Phase 0)
| Required schema | Location | Notes |
| --- | --- | --- |
| IntentResultSchema | `src/ai/schema.ts` | Intent output with mode + confidence |
| PlanSchema_v1 | `src/ai/schema.ts` | Planner output for tool steps |
| ToolCallSchema | `src/ai/schema.ts` | Standardized tool invocation shape |
| ToolResultSchema | `src/ai/schema.ts` | Standardized tool result shape |
| RetrievalResultSchema | `src/ai/schema.ts` | RAG retrieval output |
| MemoryWriteProposalSchema | `src/ai/schema.ts` | Guarded memory writes |
| StrategyPlanSchema | `src/ai/schema.ts` | Strategy planning output |

## Schema versioning policy (Phase 0)
- Semver per schema: MAJOR for breaking structural change, MINOR for additive fields, PATCH for constraint clarifications.
- Router and planner accept N-1 minor versions within the same major.
- Any schema change that could weaken tenant scoping requires explicit review and evidence for 0 cross-tenant leaks.

## Source of truth
- Report: `docs/report/Next-Generation_Agentic_Infrastructure.md`
- Repo audit: `docs/audit/ai/AI_SYSTEM_AUDIT_2026-01-31.md`
- Code paths: `src/ai/*`, `supabase/functions/*`, `supabase/migrations/*`, `tests/*`
