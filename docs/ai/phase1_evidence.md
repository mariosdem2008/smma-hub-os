# Phase 1 Evidence Log

## Baseline Audit (A1)
- UI entry component: `src/pages/ai/AgencyAiAdmin.tsx` (route `/ai/admin` in `src/App.tsx`; guided setup started via `ensureSetupThread` + `primeSetupThread`).
- API endpoint: `supabase/functions/ai-agency-admin-chat/index.ts` (handler: `handleAgencyAdminChat` / `handleAgencyAdminChatStream` in `supabase/functions/_shared/agency-admin-chat.ts`).
- Guided setup handler: `supabase/functions/_shared/agency-admin-setup.ts` (`handleAgencyAdminSetup`).
- getNextQuestion(): definition in `supabase/functions/_shared/agency-admin-setup-questions.ts`; current call site in `supabase/functions/_shared/agency-admin-setup.ts` (near line ~1210) when advancing after an answer.
- Prompt file: `src/ai/prompts/adminSetupGuided.ts`, used by `src/ai/taskRegistry.ts` for `TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2` (invoked via `runAiTask` from guided setup handler).

## Baseline Gates (A2)
- `npm run test` -> PASS (29 files, 94 tests). React Router future-flag warnings in stderr.
- `npm run lint` -> PASS.
- `npx tsc -p .` -> PASS.
- `npm run build` -> PASS. Browserslist data warning; chunk size warning (existing).

## TASK-003: Prefill bootstrap agency data
- Files changed:
  - `supabase/functions/_shared/agency-admin-setup.ts`: Build context snapshot before first turn so agency name/website are fetched even when the first guided message is generated.
  - `src/data/__tests__/agencyAdminSetupGuided.test.ts`: Added tests validating contextSnapshot agency name/website presence and null-safe handling.
- Rationale:
  - Ensure agency name/website are fetched at setup start and carried in the context snapshot used by extraction/prompt metadata.
  - Cover both populated and missing bootstrap fields without breaking flow.
- Tests added/updated:
  - `agency admin setup guided -> prefills context snapshot with agency name and website for extraction`
  - `agency admin setup guided -> handles missing agency name and website in context snapshot`
- Gates:
  - `npm run test` -> PASS (29 files, 96 tests). React Router future-flag warnings in stderr.
  - `npm run lint` -> PASS.
  - `npx tsc -p .` -> PASS.
  - `npm run build` -> PASS. Browserslist data warning; chunk size warning (existing).

## Worktree anomaly
```
 M src/ai/prompts/adminSetupGuided.ts
 M src/data/__tests__/agencyAdminSetupGuided.test.ts
 M supabase/functions/_shared/agency-admin-setup.ts
?? docs/ai/implementation_phase4_notes.md
?? docs/ai/phase1_evidence.md
?? docs/ai/phase4_verification_report.md
?? docs/ai/phase5_verification_report.md
?? docs/ai/phase6_verification_report.md
?? src/lib/__tests__/aiOpsViews.test.ts
?? supabase/migrations/20251228120000_ai_ops_metrics_views.sql
```

## TASK-003: Post-stash gates
- `npm run test` -> PASS (28 files, 95 tests). React Router future-flag warnings in stderr.
- `npm run lint` -> PASS.
- `npx tsc -p .` -> PASS.
- `npm run build` -> PASS. Browserslist data warning; chunk size warning (existing).

## TASK-003: Post-amend quick verification
- `npm run test` -> PASS (28 files, 95 tests). React Router future-flag warnings in stderr.
- `npm run lint` -> PASS.
- `npx tsc -p .` -> PASS.
- `npm run build` -> PASS. Browserslist data warning; chunk size warning (existing).

## TASK-004: Expert question registry
- Files changed:
  - `supabase/functions/_shared/agency-admin-setup-expert-questions.ts`: Added expert question registry shared by guided setup backend.
  - `src/data/__tests__/agencyAdminSetupExpertRegistry.test.ts`: Added registry import/schema/uniqueness tests.
- Rationale:
  - Provide a shared structured registry for expert questions without changing runtime behavior when orchestration is off.
- Tests added/updated:
  - `agency admin setup expert registry -> is importable from the setup handler module area`
  - `agency admin setup expert registry -> enforces schema sanity for all entries`
  - `agency admin setup expert registry -> has unique ids`
- Gates:
  - `npm run test` -> PASS (29 files, 98 tests). React Router future-flag warnings in stderr.
  - `npm run lint` -> PASS.
  - `npx tsc -p .` -> PASS.
  - `npm run build` -> PASS. Browserslist data warning; chunk size warning (existing).

## TASK-001: Adaptive guided setup prompt
- Files changed:
  - `src/ai/prompts/adminSetupGuided.ts`: Added bootstrap-aware rules with safe access, restored depth-level framing, and removed orchestration claims.
  - `src/ai/__tests__/adminSetupGuidedPrompt.test.ts`: Added prompt rule tests for bootstrap name/website.
- Tests added/updated:
  - `admin setup guided prompt -> forbids re-asking name/website when present in snapshot`
  - `admin setup guided prompt -> allows asking name/website when missing in snapshot`
- Gates:
  - `npm run test` -> PASS (30 files, 100 tests). React Router future-flag warnings in stderr.
  - `npm run lint` -> PASS.
  - `npx tsc -p .` -> PASS.
  - `npm run build` -> PASS. Browserslist data warning; chunk size warning (existing).
