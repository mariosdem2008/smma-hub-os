# Quality Review: Phase-0 and Phase-1

Date: 2026-02-05
Scope: evaluate implementation quality for completed phases against `docs/report/The AI-Guided Agency Onboarding Ecosystem.md`.

## 1. Review method

Reviewed artifacts:
- Blueprint source: `docs/report/The AI-Guided Agency Onboarding Ecosystem.md`
- Phase docs: `docs/blueprints/ai-guided-onboarding/00_overview.md`, `03_phase_plan.md`, `04_task_backlog.md`, `09_test_plan.md`
- Phase-0 automation: `scripts/traceability/ai-guided-onboarding.mjs`, `.github/workflows/ci.yml`, `package.json`
- Phase-1 implementation: `supabase/migrations/20260202038000_phase1_onboarding_state_persona_and_logs.sql`, `supabase/tests/cross-tenant-isolation.sql`
- Validation tests: `tests/unit/traceability-ai-guided-onboarding.test.ts`, `tests/integration/ai/phase1-onboarding-schema.test.ts`, `tests/security/onboarding-phase1-rls-checks.test.ts`

## 2. Phase-0 quality assessment

Status: PASS (with planning-quality caveats)

What is strong:
1. Traceability gate is implemented and CI-enforced.
2. Requirements catalog and matrix exist with stable IDs and no gaps.
3. ASCII and coverage checks are automated (`REQ -> TASK -> tests` mapping check).

Evidence:
- Decision lock and CI gate documented in `00_overview.md`.
- CI runs `npm run traceability:ai-guided-onboarding:check`.
- Traceability script validates required docs, ASCII, REQ continuity, TASK continuity, and REQ-to-test table coverage.

Phase-0 caveats:
1. Many tests listed in `09_test_plan.md` are future-phase placeholders (expected), not implemented yet.
2. `04_task_backlog.md` still contains placeholder migration filenames (`YYYYMMDDHHMMSS_*`) for future work.

Conclusion:
- Phase-0 objective (alignment/contracts/traceability baseline) is met.
- The documentation quality is high; execution quality is intentionally partial because later phases are not implemented yet.

## 3. Phase-1 quality assessment

Status: PASS- (good baseline, but security verification depth is not yet "proof-grade")

What is strong:
1. Added three required persistence primitives:
   - `ai_onboarding_status`
   - `ai_persona_vectors` (default assistant name `Alex`)
   - `ai_onboarding_turn_logs`
2. Added RLS, tenant membership policies, grants, and useful indexes.
3. Added SQL verification script checks for RLS-enabled state.
4. Added static tests asserting migration structure and security script coverage.

Evidence:
- Migration: `supabase/migrations/20260202038000_phase1_onboarding_state_persona_and_logs.sql`
- Security checks: `supabase/tests/cross-tenant-isolation.sql`
- Tests: `tests/integration/ai/phase1-onboarding-schema.test.ts`, `tests/security/onboarding-phase1-rls-checks.test.ts`

Phase-1 gaps to close before Phase-2 production hardening:
1. Cross-tenant validation is currently structural (RLS on/off), not behavioral (forced mismatch data-access attempts).
2. No DB-level constraint enforces that `client_id` belongs to the same `agency_id` in new Phase-1 tables.
3. Persona "Alex default state" is schema-backed, but there is no automatic seed/initialization path yet (requires Phase-2/Phase-5 integration logic).

Conclusion:
- Phase-1 is a solid schema foundation.
- Additional security-hardening tests are required to satisfy the "proof of zero leakage" bar.

## 4. Review of all phase designs (Phase-0 .. Phase-7)

Overall design quality: GOOD

Strengths:
1. Sequence is coherent: contracts -> schema security -> edge orchestration -> UI -> persistence -> persona reload -> observability -> hardening.
2. Hard invariants are explicitly carried across phases.
3. Backlog granularity is appropriate for incremental delivery.

Tuning recommendations:
1. Promote "tenant mismatch behavioral tests" earlier (start in Phase-1, not only Phase-7).
2. Update completed task rows in `04_task_backlog.md` with actual implementation file names as phases finish.
3. Add a lightweight "phase done checklist" section per phase doc to avoid drift between docs and implemented artifacts.

## 5. Go/No-Go decision for proceeding

Decision: GO to Phase-2, with explicit prerequisites:
1. Keep Phase-1 schema as the baseline (already done).
2. In Phase-2 implementation, add behavioral tenant-mismatch tests and scoped retrieval negative tests.
3. Track closure of the three Phase-1 gaps listed above as Phase-2 entry tasks.

## 6. Hardening update (applied after initial review)

Applied:
1. Added migration `20260202039000_phase1_tenant_consistency_hardening.sql` with trigger guards that enforce `client_id -> agency_id` consistency on:
   - `ai_onboarding_status`
   - `ai_persona_vectors`
   - `ai_onboarding_turn_logs`
2. Added onboarding-status scope consistency guard for `ai_onboarding_turn_logs.onboarding_status_id`.
3. Extended `supabase/tests/cross-tenant-isolation.sql` with trigger guard presence checks.

Remaining (to close in Phase-2):
1. Add runtime/behavioral negative tests that execute forced mismatches against live DB state (not only static migration/script assertions).

## 7. Phase-2 implementation update (applied)

Implemented:
1. Added authoritative Edge turn engine `supabase/functions/ai-onboarding/index.ts`.
2. Added onboarding state/suggestion module `src/ai/onboardingState.ts`.
3. Added resolver-enabled onboarding routing (`useBrainResolver: true` only on onboarding path).
4. Added deterministic suggestion contract enforcement (3-4 suggestions).
5. Added idempotency + replay persistence migration `20260205091000_phase2_onboarding_turn_idempotency_and_response_payload.sql`.
6. Added ai-onboarding allowlist entry and updated SQL verification checks.
7. Added phase-2 unit/integration/security tests for contract, idempotency, and guardrails.

Validation snapshot:
1. `npx vitest run src/ai/__tests__/onboardingState.test.ts src/ai/__tests__/taskToModuleMap.test.ts supabase/functions/_shared/__tests__/endpoint-guard.test.ts tests/integration/ai/phase2-ai-onboarding-edge.test.ts tests/integration/ai/phase2-onboarding-idempotency-migration.test.ts tests/security/onboarding-phase2-guardrails.test.ts tests/security/onboarding-phase2-rls-checks.test.ts`
2. `npm run traceability:ai-guided-onboarding:check`
