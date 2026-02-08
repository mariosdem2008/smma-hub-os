# Open Questions and Risks (V2)

## UNKNOWNs (require confirmation)
- OTLP exporter support in Supabase Edge runtime (P0-OBS-01): NOT REQUIRED for Phase 0/1 (DB spans only); optional future work.
- Telemetry sink selection for OTel traces (P0-OBS-01): RESOLVED (Supabase Postgres table `ai_otel_spans`).
- Provider switch triggers approval owner (P0-INFRA-03) (TODO: assign owner).
- Load test tool choice for p95 validation (P1-PERF-01): RESOLVED (see Decisions).
- Tool implementation locations for missing tools (P1-TOOLS-13): RESOLVED (tools implemented in `supabase/functions/_shared/tool-executor.ts`).
- Cutover rollback command set (P2-CUT-01): RESOLVED (see `docs/migrations/agentic-gemini/04_cutover_runbook.md`).

## Risks (1-5)
- R1 (4): Durable executor complexity could impact timeline.
- R2 (4): RAG cutover to Gemini embeddings may regress groundedness.
- R3 (5): Cross-tenant leak risk in multi-stage RAG/memory flows.
- R4 (3): OTel integration may require new infra not in repo.
- R5 (3): Human evaluation workflow depends on org coordination.

## Tenant dataflow map (Phase 0)
- Source: `tests/security/tenant-dataflow-map.md`
- Requirement: 0 cross-tenant leaks across RAG, tools, memory, and logs.

## TODOs
- TODO-01: Decide schema registry storage (DB vs repo). RESOLVED (see Decisions).
- TODO-02: Confirm evaluation harness runtime (local vs CI). RESOLVED (see Decisions).
- TODO-03: Confirm telemetry sink and exporter support. RESOLVED for Phase 0/1 (DB spans via `ai_otel_spans`; OTLP exporter optional future work).
- TODO-04: Map missing tools to repo implementation locations. RESOLVED (see tool contract matrix).
- TODO-05: Validate allowed external eval service usage.

## Decisions (Phase 0)
1) Schema registry storage
- Decision: Repo-based registry for Phase 0 (`docs/ai/schema_registry.json`).
- Rationale: Avoids new infra while enabling versioning and review.
- Owner: AI Platform.
- Date: 2026-01-31.

2) Evaluation harness runtime
- Decision: Local-only harness with CI disabled by default (`scripts/evals/run_evals.ts` gated by AI_EVALS_ENABLED).
- Rationale: Avoids runtime impact and keeps evals opt-in during Phase 0.
- Owner: AI Platform.
- Date: 2026-01-31.

3) Provider switch triggers (policy)
- Thresholds: Trigger review if cost or reliability shifts by >= 20% over a 30-day window.
- Review cadence: Monthly, or immediately if threshold is exceeded.
- Owner: AI Platform (TODO: assign named owner).

## Decisions (Phase 1)
1) Load test tool choice
- Decision: Use `scripts/perf/http_load_test.ts` (no dependencies) as the baseline p95 measurement tool.
- Rationale: Avoid new dependencies; can be run in staging against Supabase Edge endpoints with explicit auth headers.
- Owner: AI Platform.
- Date: 2026-02-01.
