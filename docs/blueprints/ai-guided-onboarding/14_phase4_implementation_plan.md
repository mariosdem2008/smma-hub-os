# Phase-4 Implementation Plan (Persistence + Dual Embeddings)

Date: 2026-02-05
Status: Ready to execute
Depends on: Phase-0, Phase-1, Phase-2, Phase-3

## 1) Audit checkpoint before Phase-4

Validated in this run:
1. Traceability gate passes (`npm run traceability:ai-guided-onboarding:check`).
2. Targeted onboarding suites pass (phase1 schema/hardening, phase2 edge/security, phase3 UI tests).
3. Build passes (`npm run build`).
4. Deployed functions:
   - `ai-onboarding`
   - `ai-brain-ingest`
5. Runtime auth smoke checks return `401` for missing auth on both functions.

Quality fix applied:
1. Session hydration race in `src/pages/ai/AiOnboardingAgency.tsx` is fixed.
2. Persisted sessions no longer get overwritten on first render.
3. Initial prompt is no longer auto-requested when a persisted session exists.
4. Regression coverage added in `src/pages/ai/__tests__/AiOnboardingAgency.test.tsx`.

## 2) Phase-4 objective

Complete the durable write path from onboarding completion to Agency Brain persistence and dual embedding materialization:
1. Persist finalized structured onboarding output.
2. Trigger ingest for canonical docs/chunks.
3. Verify both embedding stores are populated (`1536` and `768` shadow).

## 3) Required implementation scope

1. Completion bridge in `supabase/functions/ai-onboarding/index.ts`:
   - When onboarding status reaches `complete`, emit finalized payload for ingest.
   - Ensure idempotent handling for duplicate completion turns.
2. Ingest execution path in `supabase/functions/ai-brain-ingest/index.ts`:
   - Confirm/extend write path for `ai_documents` and `ai_document_chunks`.
   - Confirm/extend writes to `ai_embeddings` and `ai_embeddings_shadow_gemini_vector`.
3. Persistence contract:
   - Finalized snapshot must be schema-valid and non-null.
   - Tenant keys must be attached to all writes (`agency_id`, optional `client_id` by scope).
4. Completion evidence:
   - SQL checks for row creation and vector dimensions.
   - End-to-end integration test for completion -> ingest -> vector rows.

## 4) Out of scope for Phase-4

1. Persona cache invalidation and prompt reload sequence (Phase-5).
2. New non-onboarding retrieval surfaces.
3. Dashboard-level observability expansion (Phase-6).

## 5) Entry and exit criteria

Entry criteria:
1. `ai-onboarding` and `ai-brain-ingest` are deployable and reachable.
2. Phase-3 chat UI is stable and tested.
3. Tenant guardrails remain green in security tests.

Exit criteria:
1. Completion writes produce non-null, schema-valid brain data.
2. `ai_documents` + `ai_document_chunks` rows are created for completion artifacts.
3. `ai_embeddings` rows have `1536` dimensions.
4. `ai_embeddings_shadow_gemini_vector` rows have `768` dimensions.
5. Integration tests prove idempotent completion behavior.

## 6) Phase-4 execution order

1. Implement completion bridge in `ai-onboarding`.
2. Wire/validate ingest handoff payload contract.
3. Harden `ai-brain-ingest` write paths for idempotency and tenant scoping.
4. Add integration tests for completion and embeddings.
5. Deploy function updates.
6. Capture SQL and test evidence artifacts for traceability.

## 7) Risks and mitigations

1. Risk: Completion marks success before embeddings persist.
   - Mitigation: explicit completion transaction ordering and fallback error logging.
2. Risk: Shadow vector dimensional drift.
   - Mitigation: assert dimensions in integration tests and reject invalid writes.
3. Risk: Duplicate completion turns create duplicate docs.
   - Mitigation: idempotency keys and unique constraints on ingest artifacts.
4. Risk: Cross-tenant contamination in ingest writes.
   - Mitigation: strict tenant filters + negative security tests with forced mismatch.
