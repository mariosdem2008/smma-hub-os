# Phase-4 Implementation and Phase-5 Preparation

Date: 2026-02-05
Scope: Completion persistence and dual embedding write path.

## 1) Phase-4 delivery status

Status: Completed

Implemented:
1. Completion bridge in `supabase/functions/ai-onboarding/index.ts`:
   - On required module completion, onboarding now triggers `ai-brain-ingest`.
   - Completion is blocked if ingest fails (`ONBOARDING_COMPLETION_INGEST_FAILED`).
   - Completion ingest state is persisted in onboarding metadata:
     - `completion_ingest.status`
     - `completion_ingest.at`
     - `completion_ingest.snapshot_hash`
2. Completion idempotency hardening:
   - Snapshot hash (`SHA-256`) prevents duplicate completion ingest for identical snapshots.
3. Ingest durability hardening in `supabase/functions/ai-brain-ingest/index.ts`:
   - Added `getOrCreateBrainRow` so ingest can proceed even when no prior brain row exists.
   - Added summary artifact dedupe before write to avoid duplicate `ai_documents`.
4. Dual embedding persistence path remains active:
   - Primary vectors in `ai_embeddings`.
   - Shadow vectors in `ai_embeddings_shadow_gemini_vector` via shared embedding store.

## 2) Validation evidence

Passed:
1. Targeted integration and security suites:
   - `tests/integration/ai/phase4-onboarding-completion-ingest.test.ts`
   - `tests/integration/ai/phase4-ai-brain-ingest-persistence.test.ts`
   - `tests/security/onboarding-phase4-guardrails.test.ts`
   - Existing phase1/phase2/phase3 onboarding suites.
2. Build and traceability:
   - `npm run build`
   - `npm run traceability:ai-guided-onboarding:check`
3. Deployment:
   - `supabase functions deploy ai-onboarding`
   - `supabase functions deploy ai-brain-ingest`
4. Runtime auth smoke:
   - `ai-onboarding` unauthenticated request returns `401`.
   - `ai-brain-ingest` unauthenticated request returns `401`.

## 3) Quality gate alignment

1. Security gate:
   - No client-side invocation of `ai-brain-ingest`.
   - Edge functions keep service-role DB access.
2. Persistence gate:
   - Completion requires successful ingest before status can remain `complete`.
3. Dual embedding gate:
   - Ingest flow continues to write primary + shadow embedding records.

## 4) Phase-5 preparation (persona adoption + cache invalidation)

Objective:
1. Guarantee post-completion persona adoption in live assistant behavior.

Ready tasks:
1. On completion, enforce `ai_onboarding_status.status = complete` and confirm with integration tests.
2. Implement cache invalidation event/key bump tied to completion timestamp and tenant scope.
3. Reload prompt context from persisted persona + structured brain traits.
4. Add integration/E2E checks proving assistant name/tone/expertise switch from default to custom immediately after completion.
