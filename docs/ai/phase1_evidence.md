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

## TASK-002: Orchestration behind flag
- Files changed:
  - `supabase/functions/_shared/agency-admin-setup.ts`: Added AI_GUIDED_SETUP_ORCHESTRATION flag gate and orchestrator call with fallback to getNextQuestion.
  - `supabase/functions/_shared/agency-admin-setup-orchestrator.ts`: Added orchestrator prompt builder + selection logic using registry + ai.run.
  - `src/data/__tests__/agencyAdminSetupGuided.test.ts`: Added flag ON/OFF tests for orchestrator usage.
  - `src/data/__tests__/agencyAdminSetupOrchestrator.test.ts`: Added prompt snapshot test for orchestrator prompt blocks.
- Tests added/updated:
  - `agency admin setup guided -> flag OFF uses hardcoded next question without orchestrator`
  - `agency admin setup guided -> flag ON uses orchestrator result exactly once`
  - `agency admin setup orchestrator prompt -> includes bootstrap summary, known/missing fields, registry, and retrieval snippets`
- Proof:
  - OFF path unchanged: when flag is false, handler uses `getNextQuestion(updatedAnsweredKeys)` and does not call orchestrator.
  - ON path calls orchestrator once: when flag is true, `selectNextAdminSetupQuestion(...)` is invoked once per turn.
  - Fallback exists: invalid orchestrator output logs warning and falls back to `getNextQuestion`.
- Gates:
  - `npm run test` -> PASS (31 files, 103 tests). React Router future-flag warnings in stderr.
  - `npm run lint` -> PASS.
  - `npx tsc -p .` -> PASS.
  - `npm run build` -> PASS. Browserslist data warning; chunk size warning (existing).

## Follow-up Phase 1 gaps: Commit A (prompt invariants)
- Files changed:
  - `src/ai/__tests__/adminSetupGuidedPrompt.test.ts`
- Tests added/updated:
  - `admin setup guided prompt -> keeps required structure invariants`
- Gaps closed:
  - Prompt structure invariants validated (bootstrap block, depth levels, orchestration disclaimer, name/website rules).
- Gates:
  - `npm run test` -> PASS (31 files, 104 tests). React Router future-flag warnings in stderr.
  - `npm run lint` -> PASS.
  - `npx tsc -p .` -> PASS.
  - `npm run build` -> PASS. Browserslist data warning; chunk size warning (existing).

## Follow-up Phase 1 gaps: Commit A (prompt invariants)
- Files changed:
  - `src/ai/__tests__/adminSetupGuidedPrompt.test.ts`
- Tests added/updated:
  - `admin setup guided prompt -> keeps required structure invariants`
- Gaps closed:
  - Prompt structure invariants validated (bootstrap block, depth levels, orchestration disclaimer, name/website rules).
- Gates:
  - `npm run test` -> PASS (31 files, 105 tests). React Router future-flag warnings in stderr.
  - `npm run lint` -> PASS.
  - `npx tsc -p .` -> PASS.
  - `npm run build` -> PASS. Browserslist data warning; chunk size warning (existing).

## Follow-up Phase 1 gaps: Commit B (orchestrator fallback paths)
- Files changed:
  - `src/data/__tests__/agencyAdminSetupGuided.test.ts`
- Tests added/updated:
  - `agency admin setup guided -> flag ON falls back when orchestrator returns invalid JSON`
  - `agency admin setup guided -> flag ON falls back when orchestrator id is not in registry`
  - `agency admin setup guided -> flag ON falls back when orchestrator throws`
- Gaps closed:
  - Orchestrator error-path fallback exercised; getNextQuestion used when orchestrator fails.
- Gates:
  - `npm run test` -> PASS (31 files, 108 tests). React Router future-flag warnings in stderr.
  - `npm run lint` -> PASS.
  - `npx tsc -p .` -> PASS.
  - `npm run build` -> PASS. Browserslist data warning; chunk size warning (existing).

## Follow-up Phase 1 gaps: Commit C (DB failure paths)
- Files changed:
  - `src/data/__tests__/agencyAdminSetupGuided.test.ts`
- Tests added/updated:
  - `agency admin setup guided -> handles agency fetch failure without leaking secrets`
- Gaps closed:
  - DB failure-path handling validated with null snapshot and continued flow; no secret leakage in logs.
- Gates:
  - `npm run test` -> PASS (31 files, 109 tests). React Router future-flag warnings in stderr.
  - `npm run lint` -> PASS.
  - `npx tsc -p .` -> PASS.
  - `npm run build` -> PASS. Browserslist data warning; chunk size warning (existing).

## Follow-up Phase 1 gaps: Commit D (registry coverage)
- Files changed:
  - `src/data/__tests__/agencyAdminSetupExpertRegistry.test.ts`
- Tests added/updated:
  - `agency admin setup expert registry -> meets registry coverage expectations`
- Gaps closed:
  - Registry coverage assertions added (>=10 entries, >=2 per depth level).
- Gates:
  - `npm run test` -> PASS (31 files, 110 tests). React Router future-flag warnings in stderr.
  - `npm run lint` -> PASS.
  - `npx tsc -p .` -> PASS.
  - `npm run build` -> PASS. Browserslist data warning; chunk size warning (existing).

## TASK-STRATEGIC: Admin Chat prompting overhaul + strategic assistant mode
- Files changed:
  - `docs/ai/admin_chat_prompting_map.md`: Full prompting audit map with flow diagram and callsite inventory.
  - `docs/ai/admin_chat_context_contract.md`: Structured context blob contract.
  - `docs/ai/spec_gaps.md`: Logged ambiguity/TODOs per spec non-negotiables.
  - `prompts/admin_chat/system_v1.md`, `prompts/admin_chat/developer_v1.md`, `prompts/admin_chat/output_contracts_v1.md`.
  - `prompts/admin_chat/playbooks/offer_core_offer_v1.md`, `prompts/admin_chat/playbooks/strategy_v1.md`, `prompts/admin_chat/playbooks/copywriting_v1.md`.
  - `src/ai/promptRegistry.ts`: File-based prompt registry loader.
  - `src/ai/adminChatStrategic.ts`: Strategic router + output formatter + validation helpers.
  - `src/ai/prompts/adminGeneralChat.ts`: Strategic prompt assembly path.
  - `src/ai/taskRegistry.ts`, `src/ai/schema.ts`: Strategic output schema + feature flag.
  - `supabase/functions/_shared/agency-admin-general-ai.ts`: Strategic mode wiring, context blob, prompt version logging.
  - `supabase/functions/_shared/agency-admin-chat.ts`: Strategic gating + state patch merge.
  - `src/data/__tests__/adminChatStrategicPlaybooks.test.ts`: Playbook behavior tests.
  - `src/data/__tests__/agencyAdminSetupGuided.test.ts`: Updated tests for structured extraction + state handling.
- Rationale:
  - Centralize prompts in versioned files, inject structured context, enforce output contracts, and gate behavioral changes behind a feature flag.
  - Add strategic task routing and deterministic formatting with UNKNOWN policy enforcement.
- Gates:
  - `npm test` -> PASS (36 files, 189 tests). React Router future-flag warnings in stderr.
  - `npm run lint` -> PASS.
  - `npx tsc -p .` -> PASS.
  - `npm run build` -> PASS. Browserslist data warning; chunk size warning (existing).

## TASK-STRATEGIC: P0-P2 hardening (context merge, summary/state, prompt routing)
- Files changed:
  - `src/ai/prompts/adminGeneralChat.ts`: Deterministic playbook file mapping.
  - `src/ai/schema.ts`: Stronger strategic schema validation.
  - `src/ai/adminChatStrategic.ts`: Deliver-first ordering in formatted output.
  - `supabase/functions/_shared/agency-admin-general-ai.ts`: Summary/state persistence, caps, and fallback patches.
  - `supabase/functions/_shared/agency-admin-chat.ts`: Non-destructive ai_context_v1 merges + statePatch merge.
  - `prompts/admin_chat/*`: Strategy behavior upgrades + recommendation guidance.
  - `docs/ai/admin_chat_prompting_map.md`, `docs/ai/admin_chat_context_contract.md`, `docs/ai/spec_gaps.md`: Updated docs.
  - Tests: `src/ai/__tests__/adminGeneralChatPrompt.test.ts`, `src/ai/__tests__/adminChatStrategicSchema.test.ts`, `src/data/__tests__/agencyAdminChatHandler.test.ts`.
- Rationale:
  - Enforce deterministic prompt routing, stricter output validation, safe context merging, and rolling summaries without raw transcripts.
- Gates:
  - `npm test` -> PASS (38 files, 193 tests). React Router future-flag warnings in stderr.
  - `npm run lint` -> PASS.
  - `npx tsc -p .` -> PASS.
  - `npm run build` -> PASS. Browserslist data warning; chunk size warning (existing).

## TASK-STRATEGIC: Strategic Mode v1.1 upgrades (validator, router, loader)
- Files changed:
  - `src/ai/adminChatStrategic.ts`: Scored playbook router + stricter validator + deliver-first formatting + copywriting phrase coverage.
  - `src/ai/promptRegistry.ts`: Prompt path resolution via cwd + Node/Deno-safe file reads + empty cache guard.
  - `docs/ai/admin_chat_prompting_map.md`: Discovery + upgraded strategic mode notes.
  - `docs/ai/admin_chat_context_contract.md`: Summary/state max lengths and merge rules.
  - `docs/ai/spec_gaps.md`: Added TODOs for remaining ambiguities.
  - `src/data/__tests__/adminChatStrategicValidator.test.ts`: Invalid payload/limits tests.
  - `src/data/__tests__/adminChatStrategicRouter.test.ts`: Scored routing examples.
  - `src/data/__tests__/adminChatStrategicPlaybooks.test.ts`: Deliver-first format assertion.
  - `src/ai/__tests__/promptRegistry.test.ts`: Empty prompt cache guard.
  - `src/ai/__tests__/adminGeneralChatPrompt.test.ts`: Deterministic playbook prompt mapping (revalidated).
  - `prompts/admin_chat/empty_test.md`: Empty prompt fixture for loader test.
- Rationale:
  - Make strategic routing deterministic, enforce strict output contracts, and guarantee prompt loader correctness across runtime environments.
- Gates:
  - `npm test` -> PASS (41 files, 201 tests). React Router future-flag warnings in stderr.
  - `npm run lint` -> PASS.
  - `npx tsc -p .` -> PASS.
  - `npm run build` -> PASS. Browserslist data warning; chunk size warning (existing).

## TASK-STRATEGIC: Validator runtime fix (post-split)
- Files changed:
  - `src/ai/adminChatStrategic.ts`: Fix runtime validator parsing for unknown input.
- Gates:
  - `npm test` -> PASS (41 files, 201 tests). React Router future-flag warnings in stderr.
  - `npm run lint` -> PASS.
  - `npx tsc -p .` -> PASS.
  - `npm run build` -> PASS. Browserslist data warning; chunk size warning (existing).
