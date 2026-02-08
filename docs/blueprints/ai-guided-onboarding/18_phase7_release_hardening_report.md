# Phase-7 Release Hardening Report

Date: 2026-02-05
Scope: Security validation, release gate contracts, and evidence checklist.

## 1) Phase-7 delivery status

Status: Completed

Implemented:
1. Added observability RLS checks to `supabase/tests/cross-tenant-isolation.sql`:
   - `ai_runs_rls`
   - `ai_otel_spans_rls`
2. Added tenant mismatch guard coverage tests:
   - `tests/security/onboarding-phase7-tenant-mismatch-coverage.test.ts`
3. Added phase-7 SQL coverage test:
   - `tests/security/onboarding-phase7-rls-observability-checks.test.ts`
4. Added release-gate E2E contract test:
   - `tests/integration/ai/phase7-release-gate-e2e-contract.test.ts`
   - Verifies chain:
     - completion -> ingest
     - cache invalidation metadata
     - persona reload wiring
     - dual embeddings writes
     - observability linkage

## 2) Security gate checklist

1. Scoped retrieval RPC remains service-role only in SQL checks.
2. Onboarding + ingest + assistant retain explicit membership guards.
3. Client-side source remains free of scoped retrieval and service-role usage.
4. Observability tables (`ai_runs`, `ai_otel_spans`) are now explicitly checked for RLS in security SQL.

## 3) Release evidence checklist

Required evidence for sign-off:
1. `vitest` output for phase2-phase7 onboarding/security suites.
2. `npm run build` output.
3. `npm run traceability:ai-guided-onboarding:check` output.
4. SQL check output from `supabase/tests/cross-tenant-isolation.sql`.
5. Function deployment and unauthenticated 401 smoke outputs:
   - `ai-onboarding`
   - `ai-brain-ingest`
   - `ai-assistant`
   - `ai-agency-admin-chat`

## 4) Post-release monitoring focus (first 7 days)

1. p95 turn latency by stage (`onboarding.*`, `edge.ai-onboarding.turn_end`).
2. 5xx rate on onboarding and assistant endpoints.
3. Calibration-needed and repair-pass rates by module.
4. Persona reload events after onboarding completion.
5. Any tenant mismatch or privilege regression failures.
