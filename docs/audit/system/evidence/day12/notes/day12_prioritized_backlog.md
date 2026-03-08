# Day 12 Prioritized Remediation Backlog (P0/P1/P2)

Date: 2026-03-06

## P0 (Launch Blockers)
1. Resolve missing `generate-brand-guidelines-pdf` backend contract or remove/replace frontend invocation.
2. Resolve persistent critical test failures in full suite:
   - `src/data/__tests__/agencyAdminSetupGuided.test.ts`
   - `src/pages/__tests__/create-agency-flow.test.tsx`
3. Execute and pass live staging walkthrough for:
   - public auth/bootstrap
   - agency onboarding
   - dashboard core ops
   - client onboarding + detail tabs
   - portal
   - billing checkout/portal flow

## P1 (High Impact, Non-Blocking with Workarounds)
1. Add dedicated billing UI test coverage (currently mostly static + wiring checks).
2. Standardize user-facing error payload/format across edge function invocations.
3. Improve route/test reliability around auth redirects and create-agency transitions.

## P2 (Quality/Performance/Polish)
1. Reduce oversized JS main chunk (~2.7 MB minified) with code splitting.
2. Expand portal and tab-level empty/error state tests.
3. Strengthen integration inventory automation in CI (detect missing invoked functions).

## Execution Sequence
1. P0.1 + P0.2 immediate
2. P0.3 full staging run and evidence refresh
3. P1 batch implementation and regression
4. P2 optimization and polish
