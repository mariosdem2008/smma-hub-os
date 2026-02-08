# Test Plan (Unit / Integration / E2E / Security)

Quality gates (must pass before release):
1. Coverage gate: 100% of `REQ-###` appear in `02_traceability_matrix.md`.
2. Test gate: 100% of `REQ-###` have at least one test listed here.
3. Security gate: `match_ai_embeddings_scoped` only via Edge + service_role; no client usage.
4. Persona gate: completion sets status complete, invalidates cache, reloads prompt with stored traits.
5. Suggestion gate: every onboarding prompt returns 3-4 suggestions derived from the current brain snapshot.

## 1. Unit tests

Primary areas:
- `src/ai/brainResolver.ts` state logic (ready vs calibration_needed)
- `src/ai/router.ts` schema repair and UNKNOWN fallbacks
- Prompt templating and persona injection
- Suggestion safety filter ("no new facts")
- Client-side input validation (adaptive input)

Planned unit tests (new or extend):
- `src/ai/__tests__/brainResolver.test.ts`
- `src/ai/__tests__/router.test.ts` (extend: repair/unknown observability fields)
- `tests/unit/persona-injection.test.ts`
- `tests/unit/suggestion-safety-filter.test.ts`
- `src/lib/validation/__tests__/onboardingInput.test.ts`

## 2. Integration tests (Edge + DB)

Primary areas:
- `ai-onboarding` endpoint auth, contract, idempotency
- Snapshot echo + suggestion contract (3-4)
- Draft persistence and finalization
- `ai-brain-ingest` trigger and embedding writes
- Observability writes to `ai_otel_spans` and `ai_runs`

Planned integration tests:
- `tests/integration/edge-ai-onboarding-auth.test.ts`
- `tests/integration/edge-ai-onboarding-contract.test.ts`
- `tests/integration/edge-ai-onboarding-idempotency.test.ts`
- `tests/integration/edge-ai-onboarding-suggestions.test.ts`
- `tests/integration/edge-ai-onboarding-snapshot-echo.test.ts`
- `tests/integration/edge-ai-onboarding-complete.test.ts`
- `tests/integration/edge-ai-brain-ingest-on-complete.test.ts`
- `tests/integration/edge-onboarding-embeddings.test.ts`
- `tests/integration/prompt-cache-reload-on-complete.test.ts`

## 3. E2E tests (UI)

Primary areas:
- Full onboarding completion via chat UI
- Persona adoption immediately after completion
- Error/retry and calibration-needed UX

Planned E2E tests:
- `tests/e2e/onboarding-chat-complete.spec.ts`
- `tests/e2e/onboarding-persona-adoption.spec.ts`

## 4. Security tests

Primary areas:
- Forced tenant mismatch attempts (agency_id and client_id)
- RPC privilege enforcement (scoped match functions)
- No client references to scoped retrieval or service_role secrets

Planned security tests:
- SQL: `supabase/tests/cross-tenant-isolation.sql` (extend)
- `tests/security/edge-ai-onboarding-tenant-mismatch.test.ts`
- `tests/security/edge-ai-onboarding-client-mismatch.test.ts`
- `tests/security/no-client-rpc-match-scoped.test.ts`
- `tests/security/rpc-privilege-match-scoped.test.ts`
- `tests/security/onboarding-zero-leaks-suite.test.ts`

## 5. REQ-to-test coverage (100% required)

Each requirement must have at least one test. The list below is the minimum set; additional tests are encouraged.

| REQ | Minimum Test(s) |
| --- | --- |
| REQ-001 | `tests/e2e/onboarding-chat-complete.spec.ts` |
| REQ-002 | `tests/unit/onboarding-state-machine.test.ts` |
| REQ-003 | `src/pages/ai/__tests__/AiOnboardingChat.test.tsx` |
| REQ-004 | `src/components/onboarding-chat/__tests__/MessageStream.test.tsx` |
| REQ-005 | `src/lib/validation/__tests__/onboardingInput.test.ts` |
| REQ-006 | `src/components/onboarding-chat/__tests__/SuggestionChips.test.tsx` |
| REQ-007 | `tests/integration/edge-ai-onboarding-suggestions.test.ts` |
| REQ-008 | `tests/unit/suggestion-safety-filter.test.ts` |
| REQ-009 | `src/pages/ai/__tests__/AiOnboardingChat.integration.test.tsx` |
| REQ-010 | `src/ai/__tests__/brainResolver.test.ts` |
| REQ-011 | `tests/integration/edge-ai-onboarding-calibration.test.ts` |
| REQ-012 | `tests/unit/onboarding-prompt-templating.test.ts` |
| REQ-013 | `tests/integration/edge-ai-onboarding-contract.test.ts` |
| REQ-014 | `tests/security/onboarding-zero-leaks-suite.test.ts` |
| REQ-015 | `tests/integration/edge-ai-onboarding-turn-logs.test.ts` |
| REQ-016 | `tests/unit/schema-contract-coverage.test.ts` (extend) |
| REQ-017 | `src/ai/__tests__/router.test.ts` (extend repair assertions) |
| REQ-018 | `tests/integration/edge-ai-onboarding-unknown.test.ts` |
| REQ-019 | `tests/integration/edge-ai-onboarding-auth.test.ts` |
| REQ-020 | `tests/integration/edge-ai-onboarding-contract.test.ts` |
| REQ-021 | `tests/integration/edge-ai-brain-ingest-on-complete.test.ts` |
| REQ-022 | `src/pages/agency/__tests__/AISetup.persona.test.tsx` |
| REQ-023 | `tests/integration/edge-onboarding-embeddings.test.ts` |
| REQ-024 | `tests/security/rpc-privilege-match-scoped.test.ts` and `tests/security/no-client-rpc-match-scoped.test.ts` |
| REQ-025 | `tests/security/edge-ai-onboarding-tenant-mismatch.test.ts` |
| REQ-026 | `tests/unit/persona-defaults.test.ts` |
| REQ-027 | `tests/integration/edge-ai-onboarding-persona-steps.test.ts` |
| REQ-028 | `tests/integration/prompt-cache-reload-on-complete.test.ts` |
| REQ-029 | `tests/unit/otel-log-field-mapping.test.ts` (extend onboarding stages) |
| REQ-030 | `tests/unit/ai-runs-field-mapping.test.ts` |
| REQ-031 | `tests/integration/edge-ai-onboarding-complete.test.ts` |
| REQ-032 | `tests/e2e/onboarding-persona-adoption.spec.ts` |
| REQ-033 | `tests/security/onboarding-zero-leaks-suite.test.ts` |

## 6. Evidence checklist (release artifacts)

Attach these artifacts for staging/prod sign-off:
1. `cross-tenant-isolation.sql` output (all pass)
2. CI logs for integration + security suites
3. E2E screenshots/videos for completion and persona adoption
4. Sample onboarding trace (`trace_id`) with spans for all required stages
5. SQL query showing `ai_onboarding_status = 'complete'` for test tenant
6. SQL query showing dual embeddings rows for a completed onboarding artifact

## 7. Implemented so far (Phase-0 + Phase-1)

Currently implemented and passing:
1. `tests/unit/traceability-ai-guided-onboarding.test.ts`
2. `tests/integration/ai/phase1-onboarding-schema.test.ts`
3. `tests/integration/ai/phase1-onboarding-hardening.test.ts`
4. `tests/security/onboarding-phase1-rls-checks.test.ts`
5. `src/ai/__tests__/onboardingState.test.ts`
6. `src/ai/__tests__/taskToModuleMap.test.ts`
7. `tests/integration/ai/phase2-ai-onboarding-edge.test.ts`
8. `tests/integration/ai/phase2-onboarding-idempotency-migration.test.ts`
9. `tests/security/onboarding-phase2-guardrails.test.ts`
10. `tests/security/onboarding-phase2-rls-checks.test.ts`
