
# Sequential Migration Program Backlog V2

This backlog is planning plus Phase 0 scaffolding already applied, with Phase 1 core behaviors implemented behind flags.

## Phase 0 - Foundation and Evaluation
Objective: Establish contracts, evaluation harness, shadow Gemini embeddings, and an OpenTelemetry plan while keeping behavior unchanged.

Feature flags (default state)
- USE_NEW_PLANNER = false
- ENABLE_NEW_RAG_INDEXING = true (shadow Gemini embedding writes)
- ENABLE_RAG_RERANKING = true (enabled in `.env.example`; can be disabled via flag)
- AI_OTEL_LOGGING = true (OTel span logging to `ai_otel_spans`)

Phase 0 completion evidence (current)
- Schema expansions in `src/ai/schema.ts` (Intent/Plan/Tool/Retrieval/Memory/Strategy).
- Planner stub + prompt wiring in `src/ai/planner.ts`, `src/ai/prompts/planner.ts`.
- Shadow Gemini embedding pipeline and storage in `supabase/functions/_shared/*`, `supabase/migrations/20260201000000_add_ai_shadow_gemini_embeddings.sql`.
- OTel span storage + router logging in `src/ai/otel.ts`, `src/ai/router.ts`, `supabase/migrations/20260201001000_add_ai_otel_spans.sql`.
- Eval/test stubs in `tests/evals/*`, `tests/perf/*`, `tests/security/*`.

Phase 0 specs (evidence artifacts)
- Router intent threshold: CHAT requires confidence >= 0.90 (router prompt examples in `src/ai/prompts/classifyIntent.ts`).
- PlanSchema_v1: fields {plan_id, task_type, steps[]} with step {step_id, tool_id, input, depends_on[]} and optional parallel groups.
- Planner -> Executor contract: input includes {plan_id, steps[]} and output includes {step_id, tool_id, status, tool_result}.
- Planner safety: only tools in `src/ai/toolSchemas.ts` allowed; deny unknown tool ids.
- RAG shadow index: dual-write to `ai_embeddings_shadow_gemini`, no read path in Phase 0.
- Embedding metadata: store model id, embedding_dim, task_type, and shadow=true.
- Rerank policy (Phase 1 spec): K=50 then N=12 (documented only).
- Retrieval provenance: require agency_id, client_id, source_id, chunk_id, doc_type on every RetrievalResult.
- Memory tiers: working (in-request), episodic (thread summaries), long-term (approved writes only).

Tasks
- Task ID: P0-INFRA-01
- Objective: Create V2 migration docs and index.
- Why (ties back to deficiency #1-#10 or success metric): Enables traceability across all deficiencies and metrics.
- Repo touchpoints (exact paths or "TBD after inspection"): `docs/migrations/agentic-gemini/00_overview.md`, `docs/migrations/agentic-gemini/02_phase_backlog.md`, `docs/migrations/agentic-gemini/06_deficiency_matrix.md`.
- Implementation notes (planning-level, no code): Maintain ASCII-only docs. Link to report and audit.
- Tests to add/extend (name them; unit/integration/security/perf/evals): EVALS `tests/evals/README.md` (stub).
- Acceptance criteria (quantitative thresholds; cite report numbers): 100% tasks include dependencies and evidence artifacts.
- Rollback/flag strategy: N/A.
- Risk (1-5): 1
- Dependencies: None
- Evidence artifact to produce (doc/test spec/eval output/dashboard screenshot placeholder): `docs/migrations/agentic-gemini/02_phase_backlog.md`

- Task ID: P0-INFRA-02
- Objective: Create a repo AI inventory index with owner and location.
- Why: Reduces deficiency #10 (extend/maintain) by clarifying module ownership.
- Repo touchpoints: `docs/migrations/agentic-gemini/01_repo_reality_map.md`.
- Implementation notes: Enumerate `src/ai/*`, `supabase/functions/*`, `supabase/migrations/*` references.
- Tests: UNIT `tests/unit/ai-inventory-consistency.test.ts` (stub).
- Acceptance criteria: 100% AI modules listed with owners and paths.
- Rollback/flag strategy: N/A.
- Risk: 1
- Dependencies: P0-INFRA-01
- Evidence artifact: `docs/migrations/agentic-gemini/01_repo_reality_map.md`

- Task ID: P0-INFRA-03
- Objective: Define provider switch triggers and risk thresholds (20% cost/reliability).
- Why: Deficiency #8 (vendor lock-in).
- Repo touchpoints: `docs/migrations/agentic-gemini/05_open_questions_and_risks.md`.
- Implementation notes: Document thresholds and review cadence.
- Tests: UNIT `tests/unit/provider-switch-thresholds.test.ts` (stub).
- Acceptance criteria: Switch triggers documented with numeric thresholds.
- Rollback/flag strategy: N/A.
- Risk: 2
- Dependencies: P0-INFRA-02
- Evidence artifact: Provider switch policy in open questions doc

- Task ID: P0-SCHEMA-01
- Objective: Map current schemas to report-required contracts.
- Why: Deficiency #3; schema validity >= 99%.
- Repo touchpoints: `src/ai/schema.ts`, `docs/ai/*.schema.json`.
- Implementation notes: Map to IntentResultSchema, PlanSchema_v1, ToolCall/ToolResult, RetrievalResult, MemoryWriteProposal, StrategyPlanSchema.
- Tests: UNIT `tests/unit/schema-contract-coverage.test.ts` (stub).
- Acceptance criteria: 6/6 required schemas mapped.
- Rollback/flag strategy: N/A.
- Risk: 1
- Dependencies: P0-INFRA-02
- Evidence artifact: Schema map table in `docs/migrations/agentic-gemini/00_overview.md`

- Task ID: P0-SCHEMA-02
- Objective: Define schema versioning policy (semver) and compatibility rules.
- Why: Deficiency #3.
- Repo touchpoints: `docs/migrations/agentic-gemini/00_overview.md`.
- Implementation notes: Define backward compatible changes vs breaking changes.
- Tests: UNIT `tests/unit/schema-version-policy.test.ts` (stub).
- Acceptance criteria: 100% of core schemas assigned semver policy.
- Rollback/flag strategy: N/A.
- Risk: 2
- Dependencies: P0-SCHEMA-01
- Evidence artifact: Versioning policy section in `docs/migrations/agentic-gemini/00_overview.md`

- Task ID: P0-SCHEMA-03
- Objective: Define schema registry storage decision (DB vs repo).
- Why: Phase 0 acceptance requires registry deployment plan.
- Repo touchpoints: `docs/migrations/agentic-gemini/05_open_questions_and_risks.md`.
- Implementation notes: Decision matrix + pros/cons.
- Tests: UNIT `tests/unit/schema-registry-selection.test.ts` (stub).
- Acceptance criteria: Registry decision recorded with rationale and owner.
- Rollback/flag strategy: N/A.
- Risk: 2
- Dependencies: P0-SCHEMA-02
- Evidence artifact: Decision record in `docs/migrations/agentic-gemini/05_open_questions_and_risks.md`

- Task ID: P0-SCHEMA-04
- Objective: Define JSON Schema for ToolCall and ToolResult.
- Why: Deficiency #3 and #10.
- Repo touchpoints: `docs/migrations/agentic-gemini/07_tool_contract_matrix.md`.
- Implementation notes: Standardize tool invocation and result format across tools.
- Tests: UNIT `tests/unit/tool-schema-validation.test.ts` (stub).
- Acceptance criteria: ToolCall and ToolResult schema specs completed.
- Rollback/flag strategy: N/A.
- Risk: 2
- Dependencies: P0-SCHEMA-01
- Evidence artifact: Tool contract matrix with schemas

- Task ID: P0-ROUTER-01
- Objective: Define IntentResultSchema and CHAT vs EXECUTE thresholds.
- Why: Deficiency #5.
- Repo touchpoints: `src/ai/router.ts`, `src/ai/taskTypes.ts`.
- Implementation notes: Confidence threshold >= 0.9 for chat workflow in report.
- Tests: UNIT `tests/unit/router-intent-schema.test.ts` (stub).
- Acceptance criteria: IntentResultSchema defined; threshold >= 0.9 documented.
- Rollback/flag strategy: USE_NEW_PLANNER OFF.
- Risk: 2
- Dependencies: P0-SCHEMA-01
- Evidence artifact: Router intent spec in `docs/migrations/agentic-gemini/02_phase_backlog.md`

- Task ID: P0-ROUTER-02
- Objective: Define router prompt spec and few-shot examples.
- Why: Deficiency #5.
- Repo touchpoints: `src/ai/prompts/`.
- Implementation notes: Provide 20+ labeled examples for intent classification.
- Tests: EVALS `tests/evals/intent_classification_50.template.jsonl` (template).
- Acceptance criteria: 20+ examples in prompt spec and dataset of 50 items.
- Rollback/flag strategy: USE_NEW_PLANNER OFF.
- Risk: 2
- Dependencies: P0-ROUTER-01
- Evidence artifact: Prompt spec in `docs/migrations/agentic-gemini/02_phase_backlog.md`

- Task ID: P0-PLANNER-01
- Objective: Define PlanSchema_v1 structure.
- Why: Deficiency #5.
- Repo touchpoints: `docs/migrations/agentic-gemini/02_phase_backlog.md`.
- Implementation notes: Include parallel tool calls, step IDs, dependencies.
- Tests: UNIT `tests/unit/plan-schema-validation.test.ts` (stub).
- Acceptance criteria: PlanSchema_v1 fields and constraints documented.
- Rollback/flag strategy: USE_NEW_PLANNER OFF.
- Risk: 2
- Dependencies: P0-SCHEMA-01
- Evidence artifact: PlanSchema_v1 section in backlog doc

- Task ID: P0-PLANNER-02
- Objective: Define planner-to-executor contract (inputs/outputs).
- Why: Deficiency #2 and #5.
- Repo touchpoints: `src/ai/router.ts`, `supabase/functions/_shared/ai.ts`.
- Implementation notes: Contract fields align with PlanSchema_v1 and ToolCall schema.
- Tests: INTEGRATION `tests/integration/ai/planner-executor-contract.test.ts` (stub).
- Acceptance criteria: 100% contract fields mapped to schemas.
- Rollback/flag strategy: USE_NEW_PLANNER OFF.
- Risk: 3
- Dependencies: P0-PLANNER-01
- Evidence artifact: Contract spec in backlog doc

- Task ID: P0-PLANNER-03
- Objective: Define planner safety constraints (no disallowed tools).
- Why: Deficiency #10 and security requirement.
- Repo touchpoints: `src/ai/toolSchemas.ts`.
- Implementation notes: Planner must choose only registered tools with scope.
- Tests: SECURITY `tests/security/planner-tool-allowlist.test.ts` (stub).
- Acceptance criteria: 100% tool selection rules documented; disallowed tools rejected.
- Rollback/flag strategy: USE_NEW_PLANNER OFF.
- Risk: 3
- Dependencies: P0-TOOLS-01
- Evidence artifact: Planner safety rules in backlog doc

- Task ID: P0-TOOLS-01
- Objective: Map current tool registry to 12 report tools.
- Why: Deficiency #10.
- Repo touchpoints: `src/ai/toolSchemas.ts`, `supabase/functions/_shared/tool-executor.ts`.
- Implementation notes: Identify missing tools and owners.
- Tests: UNIT `tests/unit/tool-registry-coverage.test.ts` (stub).
- Acceptance criteria: 12/12 tools mapped or marked MISSING with task IDs.
- Rollback/flag strategy: enforce_tool_governance OFF.
- Risk: 2
- Dependencies: P0-SCHEMA-04
- Evidence artifact: `docs/migrations/agentic-gemini/07_tool_contract_matrix.md`

- Task ID: P0-TOOLS-02
- Objective: Define tool scope taxonomy (tenant-read/tenant-write/global-admin).
- Why: Deficiency #6 (cross-tenant risk).
- Repo touchpoints: `docs/migrations/agentic-gemini/07_tool_contract_matrix.md`.
- Implementation notes: Map each tool to scope.
- Tests: SECURITY `tests/security/tool-scope-taxonomy.test.ts` (stub).
- Acceptance criteria: 12/12 tools mapped to scopes.
- Rollback/flag strategy: enforce_tool_governance OFF.
- Risk: 3
- Dependencies: P0-TOOLS-01
- Evidence artifact: Tool scope column in tool contract matrix

- Task ID: P0-TOOLS-03
- Objective: Define tool budget policy (max calls, max seconds).
- Why: Deficiency #2 and #10.
- Repo touchpoints: `docs/migrations/agentic-gemini/07_tool_contract_matrix.md`.
- Implementation notes: Set default budgets per tool class.
- Tests: UNIT `tests/unit/tool-budget-policy.test.ts` (stub).
- Acceptance criteria: 12/12 tools have explicit budgets.
- Rollback/flag strategy: enforce_tool_governance OFF.
- Risk: 2
- Dependencies: P0-TOOLS-01
- Evidence artifact: Tool budget column in tool contract matrix
- Task ID: P0-RAG-01
- Objective: Shadow Gemini embedding index design using gemini-embedding-001.
- Why: Deficiency #1.
- Repo touchpoints: `supabase/functions/_shared/embeddings.ts`, `supabase/migrations`.
- Implementation notes: Dual-write to new table or column; no read path.
- Tests: INTEGRATION `tests/integration/ai/gemini-shadow-index.test.ts` (stub).
- Acceptance criteria: Shadow index design covers 100% ingestion paths.
- Rollback/flag strategy: ENABLE_NEW_RAG_INDEXING OFF.
- Risk: 2
- Dependencies: P0-INFRA-02
- Evidence artifact: Shadow index spec in backlog doc

- Task ID: P0-RAG-02
- Objective: Define embedding dimensionality and metadata for Gemini embeddings.
- Why: Deficiency #1.
- Repo touchpoints: `supabase/functions/_shared/embedding-policy.ts`, `supabase/functions/_shared/embeddings.ts`.
- Implementation notes: Record model id, dimensionality, and task type in metadata.
- Tests: UNIT `tests/unit/gemini-embedding-metadata.test.ts` (stub).
- Acceptance criteria: Metadata fields defined and required.
- Rollback/flag strategy: ENABLE_NEW_RAG_INDEXING OFF.
- Risk: 2
- Dependencies: P0-RAG-01
- Evidence artifact: Embedding metadata spec in backlog doc

- Task ID: P0-RAG-03
- Objective: Define Phase 1 retrieval K=50 -> N=12 rerank policy.
- Why: Deficiency #1; groundedness >85%.
- Repo touchpoints: `src/ai/ragPolicy.ts`, `supabase/functions/_shared/retrieval.ts`.
- Implementation notes: Configure top K and rerank to N.
- Tests: INTEGRATION `tests/integration/ai/rag-rerank-policy.test.ts` (stub).
- Acceptance criteria: K=50 and N=12 documented and testable.
- Rollback/flag strategy: enable_rag_reranking OFF.
- Risk: 2
- Dependencies: P0-RAG-01
- Evidence artifact: RAG policy spec in backlog doc

- Task ID: P0-RAG-04
- Objective: Define provenance schema for RetrievalResult.
- Why: Deficiency #6 (cross-tenant risk).
- Repo touchpoints: `docs/ai/ai_response.schema.json`, `src/ai/citations.ts`.
- Implementation notes: Require tenant_id, source_id, chunk_id, doc_type.
- Tests: SECURITY `tests/security/retrieval-provenance-required.test.ts` (stub).
- Acceptance criteria: 100% retrieval results include provenance fields.
- Rollback/flag strategy: enable_rag_reranking OFF.
- Risk: 3
- Dependencies: P0-SCHEMA-01
- Evidence artifact: RetrievalResult schema spec in backlog doc

- Task ID: P0-MEMORY-01
- Objective: Define three-tier memory contract (working, episodic, long-term).
- Why: Deficiency #9.
- Repo touchpoints: `docs/migrations/agentic-gemini/02_phase_backlog.md`.
- Implementation notes: Document read/write rules and retention windows.
- Tests: INTEGRATION `tests/integration/ai/memory-tier-contracts.test.ts` (stub).
- Acceptance criteria: 3 tiers defined with explicit write gates.
- Rollback/flag strategy: enable_episodic_memory OFF; enable_long_term_memory OFF.
- Risk: 2
- Dependencies: P0-SCHEMA-01
- Evidence artifact: Memory tier spec in backlog doc

- Task ID: P0-OBS-01
- Objective: Decide OpenTelemetry exporter feasibility in Supabase Edge (Deno).
- Why: Deficiency #7.
- Repo touchpoints: `supabase/functions/deno.json`, `docs/migrations/agentic-gemini/09_otel_plan.md`.
- Implementation notes: Decision recorded; Phase 0/1 uses DB span logging only (no OTLP exporter) due to dependency/runtime constraints.
- Tests: PERF `tests/perf/otel-exporter-feasibility.md` (stub).
- Acceptance criteria: Decision recorded with evidence and constraints.
- Rollback/flag strategy: AI_OTEL_LOGGING OFF.
- Risk: 3
- Dependencies: P0-INFRA-02
- Evidence artifact: OTel decision section in `docs/migrations/agentic-gemini/09_otel_plan.md`

- Task ID: P0-OBS-02
- Objective: Define OTel instrumentation points in Supabase Edge functions.
- Why: Deficiency #7.
- Repo touchpoints: `supabase/functions/ai-assistant/index.ts`, `supabase/functions/ai-ask/index.ts`, `supabase/functions/ai-strategy-generate/index.ts`.
- Implementation notes: Identify start span, tool span, retrieval span, logging span.
- Tests: INTEGRATION `tests/integration/ai/otel-edge-span-map.test.ts` (stub).
- Acceptance criteria: 100% of listed edge functions have instrumentation map.
- Rollback/flag strategy: AI_OTEL_LOGGING OFF.
- Risk: 2
- Dependencies: P0-OBS-01
- Evidence artifact: Edge span map in `docs/migrations/agentic-gemini/09_otel_plan.md`

- Task ID: P0-OBS-03
- Objective: Define OTel instrumentation points in src/ai runtime.
- Why: Deficiency #7.
- Repo touchpoints: `src/ai/router.ts`, `src/ai/providers/*`, `src/ai/logging.ts`.
- Implementation notes: Define spans for router, provider calls, schema validation.
- Tests: INTEGRATION `tests/integration/ai/otel-node-span-map.test.ts` (stub).
- Acceptance criteria: 100% of core src/ai components mapped.
- Rollback/flag strategy: AI_OTEL_LOGGING OFF.
- Risk: 2
- Dependencies: P0-OBS-01
- Evidence artifact: Node span map in `docs/migrations/agentic-gemini/09_otel_plan.md`

- Task ID: P0-OBS-04
- Objective: Define trace propagation headers and IDs.
- Why: Deficiency #7.
- Repo touchpoints: `docs/migrations/agentic-gemini/09_otel_plan.md`.
- Implementation notes: Use W3C traceparent, tracestate, and custom x-smma-trace-id.
- Tests: UNIT `tests/unit/trace-propagation-format.test.ts` (stub).
- Acceptance criteria: Header spec documented with field lengths and examples.
- Rollback/flag strategy: AI_OTEL_LOGGING OFF.
- Risk: 2
- Dependencies: P0-OBS-02, P0-OBS-03
- Evidence artifact: Trace schema doc

- Task ID: P0-OBS-05
- Objective: Define mapping from existing logs to OTel attributes.
- Why: Deficiency #7.
- Repo touchpoints: `src/ai/logging.ts`, `supabase/functions/_shared/ai.ts`.
- Implementation notes: Map ai_runs fields to trace attributes.
- Tests: UNIT `tests/unit/otel-log-field-mapping.test.ts` (stub).
- Acceptance criteria: 100% of ai_runs fields mapped to trace attributes.
- Rollback/flag strategy: AI_OTEL_LOGGING OFF.
- Risk: 2
- Dependencies: P0-OBS-03
- Evidence artifact: Log mapping section in `docs/migrations/agentic-gemini/09_otel_plan.md`

- Task ID: P0-EVALS-01
- Objective: Define evaluation harness structure and dataset format.
- Why: Groundedness >85% requirement.
- Repo touchpoints: `tests/evals/README.md`.
- Implementation notes: JSONL with query, mode_expected, golden_sources, expected_schema, rubric.
- Tests: EVALS `tests/evals/README.md` (stub).
- Acceptance criteria: Harness spec includes sample size >= 100.
- Rollback/flag strategy: N/A.
- Risk: 1
- Dependencies: P0-INFRA-02
- Evidence artifact: `tests/evals/README.md`

- Task ID: P0-EVALS-02
- Objective: Create golden dataset template (100+ rows).
- Why: Phase 0 acceptance.
- Repo touchpoints: `tests/evals/agentic_golden.template.jsonl`.
- Implementation notes: Provide template rows with placeholders.
- Tests: EVALS `tests/evals/agentic_golden.template.jsonl` (template).
- Acceptance criteria: >= 100 template rows.
- Rollback/flag strategy: N/A.
- Risk: 1
- Dependencies: P0-EVALS-01
- Evidence artifact: Dataset template file

- Task ID: P0-EVALS-03
- Objective: Define groundedness scoring rubric and formula.
- Why: Groundedness >85% requirement.
- Repo touchpoints: `docs/migrations/agentic-gemini/08_metrics_operationalization.md`.
- Implementation notes: Score based on citation coverage + provenance match.
- Tests: EVALS `tests/evals/groundedness_rubric.md` (stub).
- Acceptance criteria: Formula yields pass/fail threshold >= 85%.
- Rollback/flag strategy: N/A.
- Risk: 2
- Dependencies: P0-EVALS-01
- Evidence artifact: Metrics operationalization doc

- Task ID: P0-EVALS-04
- Objective: Define workflow evaluation dataset template (100 cases).
- Why: Success metric workflow success >= 95%.
- Repo touchpoints: `tests/evals/workflows/multistep_100.jsonl`.
- Implementation notes: Template rows for step sequences and expected tool results.
- Tests: EVALS `tests/evals/workflows/multistep_100.jsonl` (stub).
- Acceptance criteria: >= 100 template rows in dataset.
- Rollback/flag strategy: N/A.
- Risk: 1
- Dependencies: P0-EVALS-01
- Evidence artifact: Workflow dataset template file

- Task ID: P0-SEC-01
- Objective: Create tenant-scoping data flow map for AI paths.
- Why: Deficiency #6.
- Repo touchpoints: `supabase/tests/cross-tenant-isolation.sql`, `supabase/functions/_shared/ai.ts`.
- Implementation notes: Include RAG, tools, memory, logs; require 0 cross-tenant leaks.
- Tests: SECURITY `tests/security/tenant-dataflow-map.md` (stub).
- Acceptance criteria: 100% of data paths documented with tenant_id checks.
- Rollback/flag strategy: N/A.
- Risk: 3
- Dependencies: P0-INFRA-02
- Evidence artifact: `tests/security/tenant-dataflow-map.md`

- Task ID: P0-SEC-02
- Objective: Define explicit cross-tenant negative scenarios for RAG and tools.
- Why: Deficiency #6 (0 cross-tenant leaks).
- Repo touchpoints: `tests/security/negative-scenarios.md`.
- Implementation notes: Include mismatched agency_id, client_id, and tool scope abuse.
- Tests: SECURITY `tests/security/negative-scenarios.md` (stub).
- Acceptance criteria: 10+ negative scenarios documented with expected failure codes.
- Rollback/flag strategy: N/A.
- Risk: 3
- Dependencies: P0-SEC-01
- Evidence artifact: Negative scenarios doc

- Task ID: P0-SEC-03
- Objective: Define security logging requirements for tenant boundary violations.
- Why: Deficiency #6 and #7.
- Repo touchpoints: `src/ai/logging.ts`, `supabase/functions/_shared/ai.ts`.
- Implementation notes: Define error codes and log fields for violations.
- Tests: SECURITY `tests/security/tenant-violation-logging.test.ts` (stub).
- Acceptance criteria: Logging requirements documented with error code list.
- Rollback/flag strategy: N/A.
- Risk: 3
- Dependencies: P0-SEC-01
- Evidence artifact: `docs/migrations/agentic-gemini/11_security_logging_requirements.md`

- Task ID: P0-PERF-01
- Objective: Define latency budget per stage to meet p95 <= 2.5s.
- Why: Success metric #1.
- Repo touchpoints: `docs/migrations/agentic-gemini/08_metrics_operationalization.md`.
- Implementation notes: Allocate budget per stage with p95 sum <= 2.5s.
- Tests: PERF `tests/perf/latency-budget.md` (stub).
- Acceptance criteria: Budget table sums to <= 2.5s.
- Rollback/flag strategy: N/A.
- Risk: 2
- Dependencies: P0-OBS-03
- Evidence artifact: Metrics operationalization doc

- Task ID: P0-FLAGS-01
- Objective: Define feature flag matrix and default states.
- Why: Safe rollout and rollback.
- Repo touchpoints: `.env.example`, `docs/migrations/agentic-gemini/10_phase_dod_gates.md`.
- Implementation notes: Include all phase flags and defaults.
- Tests: UNIT `tests/unit/feature-flag-matrix.test.ts` (stub).
- Acceptance criteria: 100% of flags mapped to phases and rollback steps.
- Rollback/flag strategy: Flags default OFF.
- Risk: 1
- Dependencies: P0-INFRA-01
- Evidence artifact: `docs/migrations/agentic-gemini/10_phase_dod_gates.md`

## Phase 1 - Durability and Enforcement
Objective: Define durable execution, tool governance, and Phase 1 RAG behaviors with explicit testing and measurement.

Feature flags (default state)
- use_durable_executor = OFF
- enable_rag_reranking = OFF
- enforce_tool_governance = OFF

Tasks
- Task ID: P1-INFRA-01
- Objective: Define provider abstraction test plan and mock provider contract.
- Why: Deficiency #8 (vendor lock-in).
- Repo touchpoints: `src/ai/providers/*`, `src/ai/modelPolicy.ts`.
- Implementation notes: Define mock provider API to simulate alternate provider.
- Tests: UNIT `tests/unit/provider-facade-contract.test.ts` (stub).
- Acceptance criteria: Mock provider contract covers 100% of required methods.
- Rollback/flag strategy: N/A.
- Risk: 2
- Dependencies: P0-INFRA-02
- Evidence artifact: Provider abstraction test plan doc

- Task ID: P1-INFRA-02
- Objective: Define provider compatibility test suite across OpenAI/Gemini/Anthropic.
- Why: Deficiency #8 (vendor lock-in).
- Repo touchpoints: `src/ai/providers/*`, `tests/unit/provider-compat-suite.md`.
- Implementation notes: Define test matrix for generate, generateJson, embed, timeouts.
- Tests: UNIT `tests/unit/provider-compat-suite.md` (stub).
- Acceptance criteria: Test matrix covers 100% provider methods used by router.
- Rollback/flag strategy: N/A.
- Risk: 2
- Dependencies: P1-INFRA-01
- Evidence artifact: Provider compatibility test suite doc

- Task ID: P1-EXEC-01
- Objective: Define durable executor state machine (states, transitions).
- Why: Deficiency #2 (unreliable multi-step execution).
- Repo touchpoints: `supabase/functions/_shared/ai.ts`, `supabase/functions/_shared/tool-executor.ts`.
- Implementation notes: Define state names and transition rules.
- Tests: INTEGRATION `tests/integration/ai/executor-state-machine.test.ts` (stub).
- Acceptance criteria: 100% of transitions defined with allowed next states.
- Rollback/flag strategy: use_durable_executor OFF.
- Risk: 3
- Dependencies: P0-PLANNER-02
- Evidence artifact: Executor state machine spec in backlog doc
  States: pending -> running -> completed | failed

- Task ID: P1-EXEC-02
- Objective: Define checkpoint schema (thread_id, step_id, state).
- Why: Deficiency #2 and Phase 1 pause/resume requirement.
- Repo touchpoints: `supabase/migrations`.
- Implementation notes: Define table columns and indexes.
- Tests: INTEGRATION `tests/integration/ai/checkpoint-schema.test.ts` (stub).
- Acceptance criteria: Checkpoint schema supports resume for 10+ workflows.
- Rollback/flag strategy: use_durable_executor OFF.
- Risk: 3
- Dependencies: P1-EXEC-01
- Evidence artifact: Checkpoint schema spec in backlog doc
  Table: `ai_executor_checkpoints` (plan_id, step_id, status, agency_id, client_id, user_id, payload, created_at)

- Task ID: P1-EXEC-03
- Objective: Define checkpoint retention policy.
- Why: Deficiency #2 and reliability.
- Repo touchpoints: `supabase/migrations`, `docs/migrations/agentic-gemini/02_phase_backlog.md`.
- Implementation notes: TTL and cleanup strategy.
- Tests: INTEGRATION `tests/integration/ai/checkpoint-retention.test.ts` (stub).
- Acceptance criteria: Retention policy documented with TTL.
- Rollback/flag strategy: use_durable_executor OFF.
- Risk: 2
- Dependencies: P1-EXEC-02
- Evidence artifact: Retention policy section in backlog doc
  TTL: 30 days, cleanup via scheduled job (to be implemented in Phase 2 infra)

- Task ID: P1-EXEC-04
- Objective: Define executor retry policy (transient vs fatal).
- Why: Deficiency #2.
- Repo touchpoints: `supabase/functions/_shared/ai.ts`.
- Implementation notes: Define retry count per tool and backoff.
- Tests: UNIT `tests/unit/executor-retry-policy.test.ts` (stub).
- Acceptance criteria: Retry policy covers 100% tool categories.
- Rollback/flag strategy: use_durable_executor OFF.
- Risk: 3
- Dependencies: P1-EXEC-01
- Evidence artifact: Retry policy doc in backlog
  Policy: retries defined per tool in `src/ai/toolSchemas.ts`, enforced in tool executor

- Task ID: P1-EXEC-05
- Objective: Define executor pause/resume interface.
- Why: Phase 1 acceptance (10+ pause/resume workflows).
- Repo touchpoints: `supabase/functions/ai-job-worker/index.ts`.
- Implementation notes: Define pause trigger, resume command, and status codes.
- Tests: INTEGRATION `tests/integration/ai/pause-resume-interface.test.ts` (stub).
- Acceptance criteria: Interface spec includes status codes and payload fields.
- Rollback/flag strategy: use_durable_executor OFF.
- Risk: 3
- Dependencies: P1-EXEC-02
- Evidence artifact: Pause/resume interface spec
  Interface: ai_jobs status transitions (pending->running->succeeded/failed)

- Task ID: P1-EXEC-06
- Objective: Define durable executor success criteria and metrics.
- Why: Success metric workflow success >= 95%.
- Repo touchpoints: `docs/migrations/agentic-gemini/08_metrics_operationalization.md`.
- Implementation notes: Success = all steps complete within retries and timeouts.
- Tests: EVALS `tests/evals/workflows/multistep_100.jsonl` (stub).
- Acceptance criteria: Success definition used in eval harness.
- Rollback/flag strategy: use_durable_executor OFF.
- Risk: 2
- Dependencies: P1-EXEC-04
- Evidence artifact: Metrics operationalization doc

- Task ID: P1-SCHEMA-01
- Objective: Define EXECUTE schema validation failure categories.
- Why: Success metric EXECUTE schema validity >= 99%.
- Repo touchpoints: `src/ai/schema.ts`, `docs/migrations/agentic-gemini/08_metrics_operationalization.md`.
- Implementation notes: Categorize parse failures, missing fields, type mismatches.
- Tests: UNIT `tests/unit/execute-schema-failure-categories.test.ts` (stub).
- Acceptance criteria: 100% of failure categories documented with codes.
- Rollback/flag strategy: use_durable_executor OFF if schema validity < 99%.
- Risk: 3
- Dependencies: P0-SCHEMA-01
- Evidence artifact: Schema validity section in metrics doc
  Categories: parse_error, missing_fields, type_mismatch, constraint_violation

- Task ID: P1-EXEC-07
- Objective: Define workflow replay harness for durable executor tests.
- Why: Deficiency #2 and success metric workflow success >= 95%.
- Repo touchpoints: `tests/evals/workflows/multistep_100.jsonl`, `tests/integration/ai/executor-replay-harness.md`.
- Implementation notes: Specify replay inputs, expected outputs, and failure capture.
- Tests: INTEGRATION `tests/integration/ai/executor-replay-harness.md` (stub).
- Acceptance criteria: Replay harness spec covers 100% workflow dataset.
- Rollback/flag strategy: use_durable_executor OFF.
- Risk: 3
- Dependencies: P1-EXEC-06, P0-EVALS-04
- Evidence artifact: Replay harness spec doc

- Task ID: P1-TOOLS-01
- Objective: Define tool contract for SearchKnowledgeBase.
- Why: Deficiency #1 and #10.
- Repo touchpoints: `docs/migrations/agentic-gemini/07_tool_contract_matrix.md`.
- Implementation notes: Include JSON schema and scope.
- Tests: SECURITY `tests/security/tool-searchknowledgebase-scope.test.ts` (stub).
- Acceptance criteria: Tool row completed with schemas and tests.
- Rollback/flag strategy: enforce_tool_governance OFF.
- Risk: 2
- Dependencies: P0-TOOLS-01
- Evidence artifact: Tool contract matrix

- Task ID: P1-TOOLS-02
- Objective: Define tool contract for GetClientHistory.
- Why: Deficiency #9.
- Repo touchpoints: `docs/migrations/agentic-gemini/07_tool_contract_matrix.md`.
- Tests: SECURITY `tests/security/tool-getclienthistory-scope.test.ts` (stub).
- Acceptance criteria: Tool row completed with schemas and tests.
- Rollback/flag strategy: enforce_tool_governance OFF.
- Risk: 2
- Dependencies: P0-TOOLS-01
- Evidence artifact: Tool contract matrix

- Task ID: P1-TOOLS-03
- Objective: Define tool contract for FetchCampaignPerformance.
- Why: Deficiency #2 and #10.
- Repo touchpoints: `docs/migrations/agentic-gemini/07_tool_contract_matrix.md`.
- Tests: SECURITY `tests/security/tool-fetchcampaignperformance-scope.test.ts` (stub).
- Acceptance criteria: Tool row completed with schemas and tests.
- Rollback/flag strategy: enforce_tool_governance OFF.
- Risk: 2
- Dependencies: P0-TOOLS-01
- Evidence artifact: Tool contract matrix

- Task ID: P1-TOOLS-04
- Objective: Define tool contract for GetAccountDetails.
- Why: Deficiency #6.
- Repo touchpoints: `docs/migrations/agentic-gemini/07_tool_contract_matrix.md`.
- Tests: SECURITY `tests/security/tool-getaccountdetails-scope.test.ts` (stub).
- Acceptance criteria: Tool row completed with schemas and tests.
- Rollback/flag strategy: enforce_tool_governance OFF.
- Risk: 2
- Dependencies: P0-TOOLS-01
- Evidence artifact: Tool contract matrix

- Task ID: P1-TOOLS-05
- Objective: Define tool contract for UpdateClientRecord.
- Why: Deficiency #2 and #6.
- Repo touchpoints: `docs/migrations/agentic-gemini/07_tool_contract_matrix.md`.
- Tests: SECURITY `tests/security/tool-updateclientrecord-scope.test.ts` (stub).
- Acceptance criteria: Tool row completed with schemas and tests.
- Rollback/flag strategy: enforce_tool_governance OFF.
- Risk: 3
- Dependencies: P0-TOOLS-01
- Evidence artifact: Tool contract matrix
- Task ID: P1-TOOLS-06
- Objective: Define tool contract for CreateNewTask.
- Why: Deficiency #2.
- Repo touchpoints: `docs/migrations/agentic-gemini/07_tool_contract_matrix.md`.
- Tests: SECURITY `tests/security/tool-createnewtask-scope.test.ts` (stub).
- Acceptance criteria: Tool row completed with schemas and tests.
- Rollback/flag strategy: enforce_tool_governance OFF.
- Risk: 2
- Dependencies: P0-TOOLS-01
- Evidence artifact: Tool contract matrix

- Task ID: P1-TOOLS-07
- Objective: Define tool contract for GenerateStrategyReport.
- Why: Deficiency #2 and #5.
- Repo touchpoints: `docs/migrations/agentic-gemini/07_tool_contract_matrix.md`.
- Tests: SECURITY `tests/security/tool-generatestrategyreport-scope.test.ts` (stub).
- Acceptance criteria: Tool row completed with schemas and tests.
- Rollback/flag strategy: enforce_tool_governance OFF.
- Risk: 3
- Dependencies: P0-TOOLS-01
- Evidence artifact: Tool contract matrix

- Task ID: P1-TOOLS-08
- Objective: Define tool contract for TriggerEmailSequence.
- Why: Deficiency #2.
- Repo touchpoints: `docs/migrations/agentic-gemini/07_tool_contract_matrix.md`.
- Tests: SECURITY `tests/security/tool-triggeremailsequence-scope.test.ts` (stub).
- Acceptance criteria: Tool row completed with schemas and tests.
- Rollback/flag strategy: enforce_tool_governance OFF.
- Risk: 3
- Dependencies: P0-TOOLS-01
- Evidence artifact: Tool contract matrix

- Task ID: P1-TOOLS-09
- Objective: Define tool contract for ProposeMemoryWrite.
- Why: Deficiency #9 and #6.
- Repo touchpoints: `docs/migrations/agentic-gemini/07_tool_contract_matrix.md`.
- Tests: SECURITY `tests/security/tool-proposememorywrite-scope.test.ts` (stub).
- Acceptance criteria: Tool row completed with schemas and tests.
- Rollback/flag strategy: enforce_tool_governance OFF.
- Risk: 3
- Dependencies: P0-TOOLS-01
- Evidence artifact: Tool contract matrix

- Task ID: P1-TOOLS-10
- Objective: Define tool contract for ValidatePII.
- Why: Deficiency #6.
- Repo touchpoints: `docs/migrations/agentic-gemini/07_tool_contract_matrix.md`.
- Tests: SECURITY `tests/security/tool-validatepii-scope.test.ts` (stub).
- Acceptance criteria: Tool row completed with schemas and tests.
- Rollback/flag strategy: enforce_tool_governance OFF.
- Risk: 2
- Dependencies: P0-TOOLS-01
- Evidence artifact: Tool contract matrix

- Task ID: P1-TOOLS-11
- Objective: Define tool contract for CheckComplianceFlags.
- Why: Deficiency #6.
- Repo touchpoints: `docs/migrations/agentic-gemini/07_tool_contract_matrix.md`.
- Tests: SECURITY `tests/security/tool-checkcomplianceflags-scope.test.ts` (stub).
- Acceptance criteria: Tool row completed with schemas and tests.
- Rollback/flag strategy: enforce_tool_governance OFF.
- Risk: 2
- Dependencies: P0-TOOLS-01
- Evidence artifact: Tool contract matrix

- Task ID: P1-TOOLS-12
- Objective: Define tool contract for ApproveAction.
- Why: Deficiency #2 and #6.
- Repo touchpoints: `docs/migrations/agentic-gemini/07_tool_contract_matrix.md`.
- Tests: SECURITY `tests/security/tool-approveaction-scope.test.ts` (stub).
- Acceptance criteria: Tool row completed with schemas and tests.
- Rollback/flag strategy: enforce_tool_governance OFF.
- Risk: 3
- Dependencies: P0-TOOLS-01
- Evidence artifact: Tool contract matrix

- Task ID: P1-TOOLS-13
- Objective: Produce implementation mapping plan for missing tools.
- Why: Deficiency #10 (extend/maintain).
- Repo touchpoints: `docs/migrations/agentic-gemini/07_tool_contract_matrix.md`, `docs/migrations/agentic-gemini/05_open_questions_and_risks.md`.
- Implementation notes: For each missing tool, propose repo location and data source mapping.
- Tests: UNIT `tests/unit/tool-implementation-mapping.test.ts` (stub).
- Acceptance criteria: 100% missing tools have a proposed repo mapping and owner.
- Rollback/flag strategy: N/A.
- Risk: 2
- Dependencies: P0-TOOLS-01
- Evidence artifact: Tool implementation mapping section in `docs/migrations/agentic-gemini/07_tool_contract_matrix.md`

- Task ID: P1-RAG-01
- Objective: Define reranker model selection criteria.
- Why: Deficiency #1; groundedness >85%.
- Repo touchpoints: `docs/migrations/agentic-gemini/08_metrics_operationalization.md`.
- Implementation notes: Document model requirements and evaluation criteria.
- Tests: EVALS `tests/evals/reranker-selection.md` (stub).
- Acceptance criteria: Reranker selection criteria documented.
- Rollback/flag strategy: enable_rag_reranking OFF.
- Risk: 2
- Dependencies: P0-RAG-03
- Evidence artifact: Reranker selection section in metrics doc

- Task ID: P1-RAG-02
- Objective: Define RAG tenant scoping rules for retrieval queries.
- Why: Deficiency #6 (0 cross-tenant leaks).
- Repo touchpoints: `supabase/functions/_shared/retrieval.ts`, `supabase/tests/cross-tenant-isolation.sql`.
- Implementation notes: Must filter by agency_id and client_id.
- Tests: SECURITY `tests/security/rag-tenant-scope-negative.test.ts` (stub).
- Acceptance criteria: 0 cross-tenant leaks in negative tests.
- Rollback/flag strategy: enable_rag_reranking OFF.
- Risk: 4
- Dependencies: P0-SEC-01
- Evidence artifact: Tenant scoping rules in backlog doc

- Task ID: P1-RAG-03
- Objective: Define RAG provenance validation rules.
- Why: Deficiency #6 and groundedness.
- Repo touchpoints: `src/ai/citations.ts`, `docs/ai/ai_response.schema.json`.
- Implementation notes: Validate citations against retrieved doc IDs.
- Tests: SECURITY `tests/security/rag-provenance-validate.test.ts` (stub).
- Acceptance criteria: 100% citations must match retrieval results.
- Rollback/flag strategy: enable_rag_reranking OFF.
- Risk: 3
- Dependencies: P0-RAG-04
- Evidence artifact: Provenance validation spec (see `tests/security/rag-provenance-validate.test.ts`)

- Task ID: P1-RAG-04
- Objective: Define RAG shadow vs baseline comparison plan.
- Why: Deficiency #1 and groundedness >= 85%.
- Repo touchpoints: `docs/migrations/agentic-gemini/08_metrics_operationalization.md`.
- Implementation notes: Compare retrieval overlap, citation coverage, and groundedness score.
- Tests: EVALS `tests/evals/rag-shadow-comparison.md` (stub).
- Acceptance criteria: Comparison plan includes 3 metrics and pass thresholds.
- Rollback/flag strategy: enable_rag_reranking OFF.
- Risk: 3
- Dependencies: P0-RAG-01, P0-EVALS-03
- Evidence artifact: Shadow comparison plan in metrics doc

- Task ID: P1-OBS-01
- Objective: Define OTel trace schema for 7-stage pipeline.
- Why: Deficiency #7.
- Repo touchpoints: `docs/migrations/agentic-gemini/09_otel_plan.md`.
- Implementation notes: Define span names and attributes per stage.
- Tests: UNIT `tests/unit/otel-trace-schema.test.ts` (stub).
- Acceptance criteria: Trace schema covers all 7 stages.
- Rollback/flag strategy: AI_OTEL_LOGGING OFF.
- Risk: 2
- Dependencies: P0-OBS-04
- Evidence artifact: Trace schema doc (`docs/migrations/agentic-gemini/12_trace_schema.md`)

- Task ID: P1-OBS-02
- Objective: Define dashboard spec for success metrics and groundedness.
- Why: Deficiency #7 and Phase 2 readiness.
- Repo touchpoints: `docs/migrations/agentic-gemini/09_otel_plan.md`.
- Implementation notes: Include p95, success rate, schema validity, groundedness, leaks.
- Tests: PERF `tests/perf/dashboard-spec-smoke.md` (stub).
- Acceptance criteria: Dashboard spec includes all 5 metrics.
- Rollback/flag strategy: N/A.
- Risk: 2
- Dependencies: P1-OBS-01
- Evidence artifact: Dashboard spec section (`docs/migrations/agentic-gemini/13_dashboard_spec.md`)

- Task ID: P1-EVALS-01
- Objective: Define workflow success rate calculation for eval harness.
- Why: Success metric #2.
- Repo touchpoints: `docs/migrations/agentic-gemini/08_metrics_operationalization.md`.
- Implementation notes: Success = all steps complete within retries and timeouts.
- Tests: EVALS `tests/evals/workflows/multistep_100.jsonl` (stub).
- Acceptance criteria: Formula defined and testable.
- Rollback/flag strategy: N/A.
- Risk: 2
- Dependencies: P1-EXEC-06
- Evidence artifact: Metrics operationalization doc

- Task ID: P1-PERF-01
- Objective: Define load test plan for p95 <= 2.5s.
- Why: Success metric #1.
- Repo touchpoints: `tests/perf/agentic-load-test.md`.
- Implementation notes: Define concurrency, payloads, and measurement points.
- Tests: PERF `tests/perf/agentic-load-test.md` (stub).
- Acceptance criteria: Plan includes p95 aggregation method.
- Rollback/flag strategy: N/A.
- Risk: 3
- Dependencies: P0-PERF-01
- Evidence artifact: Load test plan doc

- Task ID: P1-SEC-01
- Objective: Define tool scope enforcement tests (negative scenarios).
- Why: Deficiency #6.
- Repo touchpoints: `tests/security/tool-scope-negative.test.ts`.
- Implementation notes: Include cross-tenant access attempts and scope escalation.
- Tests: SECURITY `tests/security/tool-scope-negative.test.ts` (stub).
- Acceptance criteria: 0 cross-tenant leaks in negative tests.
- Rollback/flag strategy: enforce_tool_governance OFF.
- Risk: 4
- Dependencies: P0-TOOLS-02
- Evidence artifact: Security test plan doc

- Task ID: P1-SEC-02
- Objective: Define tenant fuzz test plan for tools and memory reads.
- Why: Deficiency #6 (0 cross-tenant leaks).
- Repo touchpoints: `tests/security/tenant-fuzz-plan.md`.
- Implementation notes: Randomized agency_id/client_id permutations.
- Tests: SECURITY `tests/security/tenant-fuzz-plan.md` (stub).
- Acceptance criteria: Fuzz plan includes 50+ permutations and expected failures.
- Rollback/flag strategy: enforce_tool_governance OFF.
- Risk: 4
- Dependencies: P0-SEC-02
- Evidence artifact: Tenant fuzz plan doc

## Phase 2 - Advanced Capabilities and Cutover
Objective: Plan tiered memory activation, contextual ingestion, cutover readiness, and rollback runbooks.

Feature flags (default state)
- enable_episodic_memory = OFF
- enable_long_term_memory = OFF
- enable_contextual_ingestion = OFF

Tasks
- Task ID: P2-MEM-01
- Objective: Define episodic memory schema and storage location.
- Why: Deficiency #9.
- Repo touchpoints: `supabase/migrations`.
- Implementation notes: Store summary every 5 messages with thread_id.
- Tests: INTEGRATION `tests/integration/ai/episodic-schema.test.ts` (stub).
- Acceptance criteria: Schema supports thread_id, summary, checkpoint_id.
- Rollback/flag strategy: enable_episodic_memory OFF.
- Risk: 4
- Dependencies: P1-EXEC-02
- Evidence artifact: Episodic memory schema spec

- Task ID: P2-MEM-02
- Objective: Define long-term memory write approval workflow.
- Why: Deficiency #9 and #6.
- Repo touchpoints: `supabase/functions/ai-assistant/index.ts`.
- Implementation notes: Use ProposeMemoryWrite -> ApproveAction gate.
- Tests: SECURITY `tests/security/memory-approval-gate.test.ts` (stub).
- Acceptance criteria: 100% long-term writes require approval; 0 cross-tenant leaks.
- Rollback/flag strategy: enable_long_term_memory OFF.
- Risk: 4
- Dependencies: P2-MEM-01
- Evidence artifact: Long-term memory workflow spec

- Task ID: P2-MEM-03
- Objective: Define memory read scoping rules for tenant isolation.
- Why: Deficiency #6.
- Repo touchpoints: `supabase/functions/_shared/brain-documents.ts`.
- Implementation notes: Enforce agency_id and client_id filters.
- Tests: SECURITY `tests/security/memory-read-tenant-scope.test.ts` (stub).
- Acceptance criteria: 0 cross-tenant leaks in memory reads.
- Rollback/flag strategy: enable_long_term_memory OFF.
- Risk: 4
- Dependencies: P0-SEC-01
- Evidence artifact: Memory scoping rules doc

- Task ID: P2-RAG-01
- Objective: Define contextual ingestion summary generation (50-100 tokens).
- Why: Deficiency #4.
- Repo touchpoints: `supabase/functions/ai-documents-ingest/index.ts`, `supabase/functions/ai-brain-ingest/index.ts`.
- Implementation notes: Summaries stored per chunk with provenance.
- Tests: INTEGRATION `tests/integration/ai/contextual-summary.test.ts` (stub).
- Acceptance criteria: 100% chunks have 50-100 token summaries.
- Rollback/flag strategy: enable_contextual_ingestion OFF.
- Risk: 4
- Dependencies: P0-RAG-01
- Evidence artifact: Contextual ingestion spec

- Task ID: P2-RAG-02
- Objective: Define poisoning defense with manifest validation.
- Why: Deficiency #6.
- Repo touchpoints: `supabase/functions/_shared/embeddings.ts`.
- Implementation notes: Validate source against known-good manifest.
- Tests: SECURITY `tests/security/rag-poisoning-defense.test.ts` (stub).
- Acceptance criteria: 100% ingests validated; 0 cross-tenant leaks.
- Rollback/flag strategy: enable_contextual_ingestion OFF.
- Risk: 5
- Dependencies: P2-RAG-01
- Evidence artifact: Poisoning defense spec

- Task ID: P2-RAG-03
- Objective: Define cutover plan from shadow Gemini index to primary.
- Why: Deficiency #1.
- Repo touchpoints: `supabase/functions/_shared/retrieval.ts`, `supabase/functions/_shared/embeddings.ts`.
- Implementation notes: Define backfill completion and fallback to OpenAI index.
- Tests: INTEGRATION `tests/integration/ai/embedding-cutover.test.ts` (stub).
- Acceptance criteria: 100% retrieval queries can fall back; groundedness >= 85% retained.
- Rollback/flag strategy: switch back to OpenAI index via flag.
- Risk: 4
- Dependencies: P0-RAG-01, P1-RAG-01
- Evidence artifact: Embedding cutover plan doc

- Task ID: P2-OBS-01
- Objective: Define production alert thresholds for all metrics.
- Why: Deficiency #7.
- Repo touchpoints: `docs/migrations/agentic-gemini/09_otel_plan.md`.
- Implementation notes: Alerts for p95, success, schema validity, groundedness, leaks.
- Tests: PERF `tests/perf/alert-thresholds.md` (stub).
- Acceptance criteria: Alert thresholds defined for all metrics.
- Rollback/flag strategy: N/A.
- Risk: 3
- Dependencies: P1-OBS-02
- Evidence artifact: Alert thresholds section in OTel plan

- Task ID: P2-OBS-02
- Objective: Define dashboard validation checklist for production readiness.
- Why: Deficiency #7 and Phase 2 readiness.
- Repo touchpoints: `docs/migrations/agentic-gemini/09_otel_plan.md`.
- Implementation notes: Validate data freshness, alert wiring, and missing metrics.
- Tests: PERF `tests/perf/dashboard-validation.md` (stub).
- Acceptance criteria: Checklist covers all dashboards and alerts.
- Rollback/flag strategy: N/A.
- Risk: 3
- Dependencies: P2-OBS-01
- Evidence artifact: Dashboard validation checklist

- Task ID: P2-EVALS-01
- Objective: Define schema validity evaluation method.
- Why: Success metric #3.
- Repo touchpoints: `docs/migrations/agentic-gemini/08_metrics_operationalization.md`.
- Implementation notes: Validate EXECUTE outputs with JSON schema; categorize failures.
- Tests: EVALS `tests/evals/schema-validity.md` (stub).
- Acceptance criteria: >= 99% schema validity target defined with categories.
- Rollback/flag strategy: use_durable_executor OFF if below threshold.
- Risk: 3
- Dependencies: P0-SCHEMA-01
- Evidence artifact: Metrics operationalization doc

- Task ID: P2-EVALS-02
- Objective: Define human evaluation protocol for clarity and relevance.
- Why: Phase 2 acceptance (qualitative improvements).
- Repo touchpoints: `docs/migrations/agentic-gemini/08_metrics_operationalization.md`.
- Implementation notes: 100+ samples, blind review, rubric scoring.
- Tests: EVALS `tests/evals/human-review-protocol.md` (stub).
- Acceptance criteria: Human eval rubric and sampling plan documented.
- Rollback/flag strategy: N/A.
- Risk: 3
- Dependencies: P0-EVALS-01
- Evidence artifact: Human eval protocol doc

- Task ID: P2-PERF-01
- Objective: Define 7-day production validation checklist.
- Why: Phase 2 acceptance requirement.
- Repo touchpoints: `docs/migrations/agentic-gemini/10_phase_dod_gates.md`.
- Implementation notes: Daily checks for all metrics.
- Tests: PERF `tests/perf/7-day-checklist.md` (stub).
- Acceptance criteria: Checklist includes all 4 target metrics + groundedness.
- Rollback/flag strategy: revert to Phase 1 if any day fails.
- Risk: 4
- Dependencies: P2-OBS-01
- Evidence artifact: Phase DoD doc

- Task ID: P2-SEC-01
- Objective: Define full security audit plan for cross-tenant paths.
- Why: Deficiency #6 and readiness check.
- Repo touchpoints: `supabase/tests/cross-tenant-isolation.sql`.
- Implementation notes: Include RAG, memory, tools, logging; 0 cross-tenant leaks.
- Tests: SECURITY `tests/security/full-tenant-audit.md` (stub).
- Acceptance criteria: Audit plan covers 100% AI data paths.
- Rollback/flag strategy: Block cutover until audit passes.
- Risk: 5
- Dependencies: P0-SEC-01, P1-SEC-01
- Evidence artifact: Security audit plan doc

- Task ID: P2-CUT-01
- Objective: Define cutover runbook steps and rollback commands.
- Why: Phase 2 acceptance.
- Repo touchpoints: `docs/migrations/agentic-gemini/04_cutover_runbook.md`, `docs/migrations/agentic-gemini/10_phase_dod_gates.md`.
- Implementation notes: Include commands and verification steps.
- Tests: INTEGRATION `tests/integration/cutover/runbook-smoke.md` (stub).
- Acceptance criteria: Runbook covers all readiness checks and rollback steps.
- Rollback/flag strategy: Full rollback to Phase 1 via flags and infra scripts.
- Risk: 5
- Dependencies: P2-PERF-01
- Evidence artifact: Cutover runbook

- Task ID: P2-CUT-02
- Objective: Define legacy decommission checklist and verification steps.
- Why: Phase 2 acceptance requires decommission of legacy modules.
- Repo touchpoints: `docs/migrations/agentic-gemini/04_cutover_runbook.md`.
- Implementation notes: Include data retention, traffic disable, and rollback guardrails.
- Tests: INTEGRATION `tests/integration/cutover/decommission-checklist.md` (stub).
- Acceptance criteria: Checklist includes verification for all legacy modules.
- Rollback/flag strategy: Maintain rollback path until checklist completed.
- Risk: 4
- Dependencies: P2-CUT-01
- Evidence artifact: Decommission checklist
