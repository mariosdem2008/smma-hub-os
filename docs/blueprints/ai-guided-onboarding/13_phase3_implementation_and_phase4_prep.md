# Phase-3 Implementation and Phase-4 Preparation

Date: 2026-02-05
Scope: Chat onboarding UI implementation against `ai-onboarding`.

## 1) Phase-3 implementation status

Status: In progress (core UI delivered)

Implemented:
1. Agency onboarding route now serves chat onboarding UI instead of redirect:
   - `src/pages/ai/AiOnboardingAgency.tsx`
2. Message stream component with markdown and JSON snapshot rendering:
   - `src/components/onboarding-chat/MessageStream.tsx`
3. Adaptive input field with type-aware validation (`url`, `contact`, default text):
   - `src/components/onboarding-chat/AdaptiveInputField.tsx`
4. Suggestion chip tray with both interactions:
   - Tap-to-autofill
   - Tap-to-send
   - `src/components/onboarding-chat/SuggestionChipTray.tsx`
5. Local resume persistence (messages, input draft, expects, suggestions) keyed by agency.
6. Endpoint integration via `supabase.functions.invoke("ai-onboarding")` with `client_turn_id` idempotency key.
7. Retry/error/loading handling for turn submissions.

## 2) Validation evidence

Passed:
1. UI unit tests:
   - `src/components/onboarding-chat/__tests__/MessageStream.test.tsx`
   - `src/components/onboarding-chat/__tests__/AdaptiveInputField.test.tsx`
   - `src/components/onboarding-chat/__tests__/SuggestionChipTray.test.tsx`
2. Existing Phase-2 security/integration suites still pass.
3. Build check:
   - `npm run build` passed.

## 3) Gaps remaining to close Phase-3 fully

1. Client onboarding route is still V5 wizard (`AiOnboardingClient`) and not yet migrated to chat.
2. No full browser E2E flow for chat completion yet.
3. Accessibility pass for keyboard-only interaction and SR labels is not finalized.

## 4) Phase-4 preparation (persistence and dual-embedding completion flow)

Objective:
- Complete write path from onboarding completion to durable brain + ingestion artifacts.

Ready tasks:
1. Completion bridge:
   - On `ai_onboarding_status = complete`, finalize structured answers to canonical `agency_brains.brain_json` (and/or module docs).
2. Ingest trigger:
   - Invoke `ai-brain-ingest` from completion path with finalized snapshot.
3. Verify persistence:
   - Ensure `ai_documents`, `ai_document_chunks`, `ai_embeddings(1536)`, and `ai_embeddings_shadow_gemini_vector(768)` rows are written.
4. Completion transaction hardening:
   - Keep status update + final brain write + log consistency idempotent.
5. Add integration tests for completion -> ingest -> dual embeddings.

## 5) Entry checklist for Phase-4

All entry items are satisfied:
1. Chat endpoint deployed and operational.
2. Onboarding state/persona/turn-log schema deployed.
3. Chat route integrated and tested locally.
4. Traceability gate remains green.
