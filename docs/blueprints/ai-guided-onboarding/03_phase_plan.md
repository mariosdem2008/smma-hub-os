# Phase Plan (6-9 phases)

Conventions:
- Phase IDs: `PHASE-0` .. `PHASE-7`.
- Each phase has explicit entry/exit criteria and rollback.
- Hard invariants: (1) 0 cross-tenant leaks, (2) scoped match RPC only via Edge + service_role.

## PHASE-0: Alignment, contracts, and traceability baseline

- Objective: Lock API contracts, data model mapping, and traceability gates before implementation.
- Scope Included:
  - Finalize request/response schema for `ai-onboarding`.
  - Establish requirements -> tasks -> files -> tests traceability system.
  - Document current state audit and gaps.
- Scope Excluded:
  - Shipping new UI or Edge Functions.
- Entry Criteria:
  - Blueprint requirements catalog is complete and stable (`REQ-001..REQ-033`).
- Exit Criteria:
  - `02_traceability_matrix.md` covers 100% of requirements.
  - `09_test_plan.md` assigns at least one test to every requirement.
- Rollback Plan:
  - Revert docs-only changes if schema contracts are contested.
  - Keep traceability generator script isolated and optional.
- Risks + Mitigations:
  1. Risk: Contract churn delays build. Mitigation: Freeze a `v1` contract for onboarding turns and version it.
  2. Risk: Traceability drift. Mitigation: Add a generator/validator script and run it in CI.

## PHASE-1: Data model + tenant isolation hardening for onboarding state

- Objective: Add missing persistence for onboarding completion and persona traits in a tenant-safe manner.
- Scope Included:
  - Introduce `ai_onboarding_status` table + RLS.
  - Define/extend storage for personality vectors (assistant name/tone/expertise) and raw chat logs.
  - Document the 3-layer Agency Brain mapping to existing tables.
- Scope Excluded:
  - UI changes beyond wiring to read status and traits.
- Entry Criteria:
  - Phase-0 contracts approved.
  - DB migration workflow understood and reviewed.
- Exit Criteria:
  - Migrations applied: status table exists, RLS prevents cross-tenant reads/writes.
  - Minimal SQL tests prove tenant isolation for new objects.
- Rollback Plan:
  - Down-migrate (or `drop table`) new objects in non-prod.
  - Feature-flag reads of the new table in Edge Functions.
- Risks + Mitigations:
  1. Risk: RLS misconfiguration creates leak. Mitigation: add explicit forced-mismatch security tests.
  2. Risk: Persona traits spread across multiple tables. Mitigation: define a single canonical source and mirror if needed.

## PHASE-2: Edge orchestration - `ai-onboarding` turn engine (server-side)

- Objective: Build the authoritative onboarding orchestrator endpoint and enforce schema + resolver behavior.
- Scope Included:
  - Create/rename Edge Function to `ai-onboarding` (or add a compatibility alias) with versioning.
  - Integrate `brainResolver.ts` states (`ready` vs `calibration_needed`) into onboarding turn responses.
  - Guarantee 3-4 suggestions per prompt derived from current brain JSON snapshot.
  - Enforce `UNKNOWN` and repair-pass behavior through the AI router.
- Scope Excluded:
  - Full UI rollout (UI can be stubbed with a basic client).
- Entry Criteria:
  - Phase-1 DB objects available.
  - Service-role secret handling guidelines reviewed.
- Exit Criteria:
  - Edge integration tests pass for onboarding turn progression and suggestion contract.
  - Retrieval calls (if any) are only server-side with service_role.
- Rollback Plan:
  - Keep existing onboarding endpoints operational (`ai-onboarding-guide`, etc.) behind routing/feature flags.
  - Disable `ai-onboarding` deployment via function routing config if regressions occur.
- Risks + Mitigations:
  1. Risk: Router defaults do not enable brain resolver. Mitigation: instantiate router with `useBrainResolver: true` for onboarding path only.
  2. Risk: Suggestion derivation is weak. Mitigation: require snapshot inclusion + deterministic "no new facts" heuristic filter.

## PHASE-3: UI - chat onboarding experience (message stream, adaptive input, chip tray)

- Objective: Implement the required chat UX and connect it to the `ai-onboarding` turn engine.
- Scope Included:
  - Message stream with markdown rendering and structured JSON render blocks.
  - Adaptive input field driven by backend step spec (type + constraints).
  - Suggestion chip tray with tap-to-autofill and tap-to-send.
  - Streaming states (loading, retry, partial deltas if supported).
- Scope Excluded:
  - Non-onboarding chat products (client portal assistant, admin chat).
- Entry Criteria:
  - Phase-2 endpoint contract is stable.
- Exit Criteria:
  - E2E flow completes onboarding via chat UI using the `ai-onboarding` endpoint.
  - UI meets accessibility and error/retry expectations.
- Rollback Plan:
  - Feature flag new chat onboarding route; keep existing onboarding route available.
  - UI fallbacks to non-streamed responses if streaming is unstable.
- Risks + Mitigations:
  1. Risk: UI is implemented as a wizard, not chat. Mitigation: enforce message stream as primary interaction surface.
  2. Risk: Suggestion UX inconsistent. Mitigation: strict UI contract: always show 3-4 chips for turns that accept input.

## PHASE-4: Persistence - 3-layer Agency Brain write paths + dual embeddings

- Objective: Persist all required layers and ensure embeddings are written in both vector stores.
- Scope Included:
  - Store personality vectors (assistant traits) and finalized JSON structured answers.
  - Store raw chat logs with turn metadata and tenant scoping.
  - Trigger `ai-brain-ingest` to write `ai_documents`, `ai_document_chunks`, `ai_embeddings`, and shadow embeddings (768).
- Scope Excluded:
  - Broad RAG expansion beyond the onboarding use case.
- Entry Criteria:
  - Phase-2 and Phase-3 flows functional in staging.
- Exit Criteria:
  - On completion, the durable brain dataset is non-null and schema-validated.
  - Dual embeddings are present for ingested artifacts (when shadow enabled).
- Rollback Plan:
  - Keep raw chat logs writes but disable embedding writes via config if costs/spikes occur.
  - Stop calling `ai-brain-ingest` and revert to JSON-only persistence temporarily.
- Risks + Mitigations:
  1. Risk: Embedding writes fail and block onboarding. Mitigation: define fail-soft vs fail-hard policy; record error and allow completion if acceptable.
  2. Risk: Shadow embeddings dimension drift. Mitigation: validate dimensions and log failures explicitly.

## PHASE-5: Persona adoption, cache invalidation, and prompt reload

- Objective: Ensure immediate persona adoption after onboarding completion (persona gate).
- Scope Included:
  - Write `ai_onboarding_status = "complete"`.
  - Cache invalidation of the assistant system prompt/context snapshot.
  - Prompt reload using stored personality vectors and structured answers.
- Scope Excluded:
  - Large refactors of prompt building across unrelated tasks.
- Entry Criteria:
  - Phase-4 persistence flows are stable.
- Exit Criteria:
  - Post-completion interaction uses custom name/tone/expertise.
  - Evidence logs show invalidation and reload sequence.
- Rollback Plan:
  - Disable prompt cache and accept higher latency temporarily.
  - Fall back to default "Alex" persona if traits are missing/corrupt (without blocking onboarding completion).
- Risks + Mitigations:
  1. Risk: Stale prompt cache persists. Mitigation: explicit version key based on onboarding completion timestamp.
  2. Risk: Traits injection breaks schema. Mitigation: validate traits schema separately and use defaults on failure.

## PHASE-6: Observability + quality instrumentation

- Objective: Make onboarding behavior measurable and debuggable end-to-end.
- Scope Included:
  - Ensure spans for each onboarding turn and sub-stages are written to `ai_otel_spans`.
  - Ensure each model call is recorded in `ai_runs` with consistent fields.
  - Provide dashboards/queries and define SLOs.
- Scope Excluded:
  - Organization-wide observability changes unrelated to onboarding.
- Entry Criteria:
  - Core flow passes in staging.
- Exit Criteria:
  - Dashboards/queries validate p95 latency and error rates in staging.
  - Repair-pass rate and calibration-loop counts are measurable.
- Rollback Plan:
  - Reduce span granularity (aggregate stages) if write volume is too high.
  - Keep minimal "turn start/turn end" spans if needed.
- Risks + Mitigations:
  1. Risk: Logging includes PII. Mitigation: redact user input where required; store references/hashes.
  2. Risk: Excessive write volume. Mitigation: sampling for non-error spans in prod if necessary.

## PHASE-7: Security validation, E2E tests, and release hardening

- Objective: Prove 0 cross-tenant leaks and ship with confidence.
- Scope Included:
  - Automated security tests for forced tenant mismatch attempts.
  - Integration tests for Edge Functions using service_role rules.
  - E2E tests for full completion + persona adoption + cache reload.
  - Coverage gate enforcement via traceability checks.
- Scope Excluded:
  - Non-onboarding security work.
- Entry Criteria:
  - Observability and persistence are in place.
- Exit Criteria:
  - All quality gates pass (coverage, tests, security, persona, suggestion).
  - Release checklist completed with evidence artifacts attached.
- Rollback Plan:
  - Feature-flag the AI chat onboarding route to off in prod.
  - Disable server-side retrieval features that rely on embeddings if a leak risk is detected.
- Risks + Mitigations:
  1. Risk: Hidden cross-tenant leak path. Mitigation: add SQL privilege assertions + runtime guardrails + negative tests.
  2. Risk: Suggestion contract regression. Mitigation: enforce in integration tests and as a schema-level response validator.

