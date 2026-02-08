# Phase-2 Audit and Phase-3 Preparation

Date: 2026-02-05
Project ref: `dbclmdeowohzmwtkktsa`

## 1) Audit summary

Phase-2 status: PASS (implementation, deployment, and verification complete)

What was checked:
1. Edge orchestration exists and is active:
   - `supabase/functions/ai-onboarding/index.ts`
2. Resolver behavior exists (`ready` vs `calibration_needed`) and is onboarding-scoped.
3. Suggestion contract is enforced to 3-4 entries per turn.
4. Idempotent turn submission and replay persistence are implemented.
5. Tenant guardrails are in place (membership and client->agency checks).
6. Traceability gate still passes.

## 2) Findings and fixes applied in this run

No critical code defects found in Phase-2 implementation.

Operational fixes completed:
1. Pushed pending onboarding migrations to remote DB:
   - `20260202038000_phase1_onboarding_state_persona_and_logs.sql`
   - `20260202039000_phase1_tenant_consistency_hardening.sql`
   - `20260205091000_phase2_onboarding_turn_idempotency_and_response_payload.sql`
2. Deployed new Edge Function:
   - `ai-onboarding` (ACTIVE, version 1)

## 3) Deployment and runtime verification evidence

Commands executed:
1. `supabase functions deploy ai-onboarding`
2. `supabase migration list`
3. `supabase db push`
4. `curl -X POST https://dbclmdeowohzmwtkktsa.functions.supabase.co/ai-onboarding -d "{}"` -> `401 Missing authorization header`
5. `curl -X POST ... -H "Authorization: Bearer invalid.jwt.token"` -> `401 Invalid JWT`

Notes:
- The unauthenticated and invalid-token checks confirm function routing and auth enforcement.
- Full authenticated turn-flow smoke test requires a valid agency member JWT in this environment.

## 4) Test verification results

Local test suites run and passing:
1. Phase-0/1/2 onboarding and security suites (23 tests total).
2. Traceability gate:
   - `npm run traceability:ai-guided-onboarding:check` -> PASS

## 5) Phase-3 preparation package (UI chat onboarding)

Phase-3 target from plan:
- Build chat onboarding UX connected to `ai-onboarding` endpoint.

Ready-to-implement scope:
1. Route/page shell:
   - Create onboarding chat page and route wiring.
2. Message Stream component:
   - Render markdown assistant text and JSON snapshots.
3. Adaptive Input component:
   - Type-aware validation driven by `expects`.
4. Suggestion Chip Tray:
   - Render 3-4 chips; support tap-to-autofill and tap-to-send.
5. Edge hook/service:
   - Add UI client for `ai-onboarding` with `client_turn_id` idempotency key.
6. UX states:
   - Loading, retry, recoverable UNKNOWN handling.
7. Resume support:
   - Persist local turn/session state and restore draft input.
8. UI tests:
   - Component tests and one E2E completion path against mocked API.

## 6) Phase-3 entry checklist

All required entry criteria are satisfied:
1. Phase-2 endpoint is deployed and reachable.
2. DB schema for onboarding status/persona/turn-log/idempotency is applied.
3. Contract behavior is covered by integration/security tests.
4. Traceability checks are green.

## 7) Known constraints before UI rollout

1. For staging E2E with real backend, provision test JWTs for agency-member users.
2. Keep legacy endpoints (`ai-onboarding-guide`, `ai-onboarding-suggest`) available during rollout for fallback.
