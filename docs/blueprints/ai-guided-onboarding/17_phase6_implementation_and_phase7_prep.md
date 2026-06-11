# Phase-6 Implementation and Phase-7 Preparation

Date: 2026-02-05
Scope: Observability instrumentation for onboarding and assistant flows.

## 1) Phase-6 delivery status

Status: Completed

Implemented:
1. Onboarding span staging in `supabase/functions/ai-onboarding/index.ts`:
   - Added spans:
     - `onboarding.auth`
     - `onboarding.snapshot.load`
     - `onboarding.resolver`
     - `onboarding.suggestions`
     - `onboarding.ingest`
     - `onboarding.persist`
   - Enriched `edge.ai-onboarding.turn_end` attributes with:
     - module/state/missing_fields_count
     - suggestions_count/suggestions_fallback
     - repair_attempted/repair_success
     - ingest_status/cache_invalidated/onboarding_status
2. Onboarding `ai_runs` metadata enrichment:
   - Added trace and execution linkage keys:
     - `trace_id`, `span_id`, `request_id`
     - `module_key`, `resolver_state`
     - `schema_ok`, `repair_attempted`, `repair_success`
3. Assistant observability enrichment in `supabase/functions/ai-assistant/index.ts`:
   - Added `edge.ai-assistant.persona_context` span.
   - Added turn-end attributes:
     - `persona_reloaded`, `persona_source`, `persona_cache_version`
     - `context_request_count`
4. Admin chat run metadata enrichment in `supabase/functions/_shared/agency-admin-general-ai.ts`:
   - Added `prompt_cache_version` and `persona_source` into AI metadata and `ai_runs` metadata.

## 2) Validation evidence

Passed:
1. New phase-6 tests:
   - `tests/integration/ai/phase6-observability-onboarding.test.ts`
   - `tests/integration/ai/phase6-observability-assistant.test.ts`
2. Existing phase2-phase5 onboarding/security tests.
3. Build and traceability:
   - `npm run build`
   - `npm run traceability:ai-guided-onboarding:check`
4. Deployment:
   - `ai-onboarding`
   - `ai-assistant`
   - `ai-agency-admin-chat`
5. Runtime auth smoke:
   - all three endpoints return `401` unauthenticated (expected).

## 3) SLO instrumentation alignment

1. p95 latency by stage is now queryable via richer span stages.
2. Repair-pass and calibration behavior is now measurable from span attributes.
3. Persona reload behavior is now visible at assistant request level.

## 4) Phase-7 preparation (security validation + release hardening)

Objective:
1. Prove zero cross-tenant leaks and finalize release readiness gates.

Ready tasks:
1. Add negative integration tests for forced tenant mismatch across all onboarding data paths.
2. Add SQL-level assertions for scoped retrieval privileges and denied authenticated execution.
3. Add end-to-end completion tests with persona adoption and prompt reload verification.
4. Add release evidence bundle checklist:
   - security test outputs
   - observability query snapshots
   - deployment + smoke logs
