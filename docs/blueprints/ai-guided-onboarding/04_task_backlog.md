# Task Backlog (60-90 tasks)

Conventions:
- Task IDs: `TASK-001` .. `TASK-072` (no gaps).
- Each task lists: description, mapped requirements, dependencies, files, acceptance criteria, tests, evidence.
- Tasks are sized for ~0.5 to 1.5 days each.

NOTE: This file is intentionally long. If editing, preserve the exact `TASK-###` headings and field labels.

## TASK-001: Freeze `ai-onboarding` API contract (v1)

- Description: Define and version the request/response schema for onboarding turns, including suggestions and current JSON state echo.
- Mapped Requirements: REQ-007, REQ-009, REQ-020
- Dependencies: None
- Files to touch:
  - `docs/blueprints/ai-guided-onboarding/07_ui_spec_chat_onboarding.md`
  - `docs/blueprints/ai-guided-onboarding/08_data_model_and_persistence.md`
- Acceptance Criteria:
  - Contract includes: `messages[]`, `current_state_json`, `step_id`, `expects`, `assistant_message`, `suggestions[3-4]`, `status`.
  - Contract is explicit about when structured JSON is returned vs freeform text.
  - Contract includes error shape + retryable codes.
- Tests to add/run:
  - Unit: add a schema snapshot test in `tests/unit/router-intent-schema.test.ts` (or new contract test file).
- Evidence to attach:
  - Markdown contract excerpt + schema snapshot diff output.

## TASK-002: Add traceability validator + matrix generator script

- Description: Implement a tiny script that validates REQ/TASK coverage and generates `02_traceability_matrix.md` from the backlog.
- Mapped Requirements: REQ-033
- Dependencies: TASK-001
- Files to touch:
  - `scripts/traceability/ai-guided-onboarding.mjs`
  - `docs/blueprints/ai-guided-onboarding/02_traceability_matrix.md`
- Acceptance Criteria:
  - Script fails if any `REQ-###` has 0 mapped tasks.
  - Script fails if any `TASK-###` has 0 files or 0 tests listed.
  - Script outputs a deterministic traceability table (stable ordering).
- Tests to add/run:
  - Unit: add `tests/unit/traceability-ai-guided-onboarding.test.ts` (parse/validate).
- Evidence to attach:
  - Script run output showing 100% coverage and 0 errors.

## TASK-003: Inventory existing onboarding endpoints and decide aliasing strategy

- Description: Confirm whether to create a new `ai-onboarding` function or alias existing `ai-onboarding-guide` as `ai-onboarding`.
- Mapped Requirements: REQ-019, REQ-020
- Dependencies: TASK-001
- Files to touch:
  - `supabase/functions/ai-onboarding-guide/index.ts`
  - `supabase/functions/ai-onboarding/index.ts` (new, if created)
- Acceptance Criteria:
  - Decision documented: "create new" vs "alias/rename" with compatibility plan.
  - If aliasing, contract differences are enumerated and versioned.
  - Deployment checklist updated to include final endpoint name.
- Tests to add/run:
  - Integration: add a smoke test in `tests/integration/edge-ai-onboarding.test.ts`.
- Evidence to attach:
  - Function list output + endpoint contract mapping notes.

## TASK-004: Map blueprint "Agency Brain 3 layers" to concrete tables

- Description: Define canonical tables/columns for personality vectors, structured answers JSON, and raw chat logs.
- Mapped Requirements: REQ-015
- Dependencies: TASK-001
- Files to touch:
  - `docs/blueprints/ai-guided-onboarding/08_data_model_and_persistence.md`
- Acceptance Criteria:
  - Each layer has a single canonical write path and read path.
  - The mapping specifies tenant scoping keys and indexes.
  - The mapping specifies how the current brain JSON snapshot is assembled.
- Tests to add/run:
  - Unit: add `tests/unit/onboarding-brain-snapshot-shape.test.ts`.
- Evidence to attach:
  - Data model diagram/table spec in markdown.

## TASK-005: Add coverage gates to CI

- Description: Ensure traceability validator runs in CI (or local test pipeline) and blocks merges on coverage failures.
- Mapped Requirements: REQ-033
- Dependencies: TASK-002
- Files to touch:
  - `package.json`
  - `scripts/traceability/ai-guided-onboarding.mjs`
- Acceptance Criteria:
  - `npm test` (or equivalent) runs the validator.
  - A failing mapping produces an actionable error message (missing REQ/TASK IDs).
  - Docs remain ASCII-only (validator checks).
- Tests to add/run:
  - Unit: `tests/unit/traceability-ai-guided-onboarding.test.ts`.
- Evidence to attach:
  - CI log excerpt showing validator executed and passed.

## TASK-006: Create `ai_onboarding_status` table + RLS

- Description: Add DB persistence for onboarding completion state, scoped by `agency_id` (and optionally `client_id`).
- Mapped Requirements: REQ-028, REQ-025
- Dependencies: TASK-004
- Files to touch:
  - `supabase/migrations/20260202038000_phase1_onboarding_state_persona_and_logs.sql`
  - `supabase/migrations/20260202039000_phase1_tenant_consistency_hardening.sql`
- Acceptance Criteria:
  - Table includes: `agency_id`, `client_id` nullable, `status` enum/text, `completed_at`, `updated_at`.
  - RLS allows only agency members to select/insert/update their tenant rows.
  - Index supports `agency_id, client_id, updated_at`.
- Tests to add/run:
  - Security: extend `supabase/tests/cross-tenant-isolation.sql` for the new table.
- Evidence to attach:
  - SQL output proving forced mismatch reads return 0 rows.

## TASK-007: Define personality vectors storage (persona traits)

- Description: Choose and implement a canonical storage location for assistant name/tone/expertise ("personality vectors" layer).
- Mapped Requirements: REQ-026, REQ-027, REQ-015
- Dependencies: TASK-006
- Files to touch:
  - `supabase/migrations/20260202038000_phase1_onboarding_state_persona_and_logs.sql`
  - `supabase/migrations/20260202039000_phase1_tenant_consistency_hardening.sql`
  - `src/ai/prompts/*` (prompt assembly points)
- Acceptance Criteria:
  - Default persona values exist ("Alex" baseline) when no custom traits are stored.
  - Stored traits are tenant-scoped and queryable.
  - Trait schema is validated (no empty name; bounded tone/expertise fields).
- Tests to add/run:
  - Unit: `tests/unit/persona-defaults.test.ts`.
- Evidence to attach:
  - DB row example + unit test output.

## TASK-008: Add raw onboarding chat logs storage with tenant scoping

- Description: Persist raw chat logs for onboarding turns, including turn metadata and trace IDs.
- Mapped Requirements: REQ-015, REQ-029
- Dependencies: TASK-006
- Files to touch:
  - `supabase/migrations/20260202038000_phase1_onboarding_state_persona_and_logs.sql`
  - `supabase/migrations/20260202039000_phase1_tenant_consistency_hardening.sql`
- Acceptance Criteria:
  - Each turn records: `agency_id`, optional `client_id`, `turn_index`, `messages_json`, `created_at`.
  - RLS enforces agency membership for all CRUD.
  - Retention policy is defined (e.g., keep last N turns or keep forever with size bounds).
- Tests to add/run:
  - Security: add negative tests in `supabase/tests/cross-tenant-isolation.sql`.
- Evidence to attach:
  - Query output showing correct scoping and ordering.

## TASK-009: Implement `ai-onboarding` Edge Function skeleton + auth guard

- Description: Create the `ai-onboarding` function entrypoint with CORS, auth, membership checks, and version header.
- Mapped Requirements: REQ-019, REQ-020, REQ-025
- Dependencies: TASK-003, TASK-006
- Files to touch:
  - `supabase/functions/ai-onboarding/index.ts`
  - `supabase/functions/_shared/endpoint-guard.ts`
- Acceptance Criteria:
  - Requires bearer token and verifies agency membership.
  - Rejects missing `agency_id` (and `client_id` when required).
  - Emits a root `ai_otel_spans` span for request start/end.
- Tests to add/run:
  - Integration: `tests/integration/edge-ai-onboarding-auth.test.ts`.
- Evidence to attach:
  - Logs showing unauthorized/forbidden paths and success path.

## TASK-010: Add onboarding turn request/response types and runtime validation

- Description: Define strict runtime validation for onboarding payloads (e.g., zod) in Edge Function.
- Mapped Requirements: REQ-013, REQ-020
- Dependencies: TASK-001, TASK-009
- Files to touch:
  - `supabase/functions/ai-onboarding/index.ts`
  - `supabase/functions/_shared/zod.edge.ts`
- Acceptance Criteria:
  - Invalid payloads return 400 with field-level errors.
  - Response shape always includes `assistant_message`, `expects`, and `suggestions[3-4]` for input turns.
  - Validation errors are recorded in spans.
- Tests to add/run:
  - Integration: `tests/integration/edge-ai-onboarding-contract.test.ts`.
- Evidence to attach:
  - Sample 400 response + test output.

## TASK-011: Integrate `brainResolver.ts` into onboarding router path

- Description: Ensure onboarding uses the resolver states (`ready` vs `calibration_needed`) each turn.
- Mapped Requirements: REQ-010, REQ-011
- Dependencies: TASK-009
- Files to touch:
  - `supabase/functions/ai-onboarding/index.ts`
  - `src/ai/brainResolver.ts`
  - `src/ai/router.ts`
- Acceptance Criteria:
  - On each turn, resolver is invoked with the relevant task/module.
  - If `calibration_needed`, response includes a follow-up question and does not advance module.
  - Resolver output is recorded as span attributes (missing fields count, modules).
- Tests to add/run:
  - Unit: `src/ai/__tests__/brainResolver.test.ts` (add if missing).
  - Integration: `tests/integration/edge-ai-onboarding-calibration.test.ts`.
- Evidence to attach:
  - Trace logs showing calibration path taken and returned.

## TASK-012: Enable brain resolver only for onboarding instantiation

- Description: Instantiate AI router with `useBrainResolver: true` for onboarding path without changing global defaults.
- Mapped Requirements: REQ-010
- Dependencies: TASK-011
- Files to touch:
  - `supabase/functions/ai-onboarding/index.ts`
  - `src/ai/router.ts`
- Acceptance Criteria:
  - Onboarding calls use resolver-enabled router instance.
  - Other endpoints continue using default router behavior.
  - Regression tests for non-onboarding tasks remain passing.
- Tests to add/run:
  - Unit: `src/ai/__tests__/router.test.ts`.
- Evidence to attach:
  - Test run output + diff of router instantiation wiring.

## TASK-013: Implement schema enforcement + repair for onboarding structured outputs

- Description: Route structured extraction steps through taskRegistry schemas and rely on router repair pass.
- Mapped Requirements: REQ-016, REQ-017
- Dependencies: TASK-010, TASK-012
- Files to touch:
  - `supabase/functions/ai-onboarding/index.ts`
  - `src/ai/taskRegistry.ts`
  - `src/ai/router.ts`
- Acceptance Criteria:
  - Invalid JSON responses trigger repair pass before returning to UI.
  - If repair fails, response is `UNKNOWN` with a reason code and recoverable next action.
  - Repair-pass rate is measurable (span attribute + counter).
- Tests to add/run:
  - Unit: `src/ai/__tests__/router.test.ts` (repair path).
  - Integration: `tests/integration/edge-ai-onboarding-repair.test.ts`.
- Evidence to attach:
  - A recorded failing-to-valid repair example (sanitized).

## TASK-014: Enforce `UNKNOWN` behavior when required context is missing

- Description: Ensure missing agency/client context returns controlled `UNKNOWN` outputs and UI-safe prompts.
- Mapped Requirements: REQ-018
- Dependencies: TASK-010
- Files to touch:
  - `supabase/functions/ai-onboarding/index.ts`
  - `src/ai/router.ts`
- Acceptance Criteria:
  - Missing `agency_id` or missing required brain context yields `UNKNOWN` payload.
  - UI can render the `UNKNOWN` response and present next steps.
  - Unknown reasons are logged to `ai_runs` and `ai_otel_spans`.
- Tests to add/run:
  - Integration: `tests/integration/edge-ai-onboarding-unknown.test.ts`.
- Evidence to attach:
  - Unknown response fixture + logs.

## TASK-015: Implement agency-aware prompt templating (no fabricated values)

- Description: Add prompt templating that substitutes known variables (agency name, niche) and falls back gracefully when absent.
- Mapped Requirements: REQ-012
- Dependencies: TASK-011
- Files to touch:
  - `supabase/functions/ai-onboarding/index.ts`
  - `src/ai/prompts/*` (onboarding prompts)
- Acceptance Criteria:
  - Placeholders are only replaced with known values from stored JSON.
  - When values are missing, generic phrasing is used (no hallucinated names).
  - Personalization behavior is consistent across steps.
- Tests to add/run:
  - Unit: `tests/unit/onboarding-prompt-templating.test.ts`.
- Evidence to attach:
  - Prompt rendering snapshots (sanitized).

## TASK-016: Implement deterministic suggestion contract (3-4, derived from snapshot)

- Description: Guarantee that every onboarding prompt returns 3-4 suggestions derived from the current brain snapshot.
- Mapped Requirements: REQ-007, REQ-008
- Dependencies: TASK-010, TASK-015
- Files to touch:
  - `supabase/functions/ai-onboarding/index.ts`
  - `supabase/functions/_shared/retrieval.ts` (if used for context)
- Acceptance Criteria:
  - Suggestions array length is always 3 or 4 for input turns.
  - Suggestions are built from snapshot fields; any "new facts" are filtered out.
  - If AI suggestion generation fails, a deterministic fallback produces 3-4 safe suggestions.
- Tests to add/run:
  - Integration: `tests/integration/edge-ai-onboarding-suggestions.test.ts`.
- Evidence to attach:
  - Example payload showing snapshot echo + 3-4 suggestions.

## TASK-017: Add tap-to-send semantics in endpoint (idempotent turn submit)

- Description: Ensure endpoint supports immediate submit of a suggested chip as user input and advances turn idempotently.
- Mapped Requirements: REQ-009, REQ-020
- Dependencies: TASK-016
- Files to touch:
  - `supabase/functions/ai-onboarding/index.ts`
- Acceptance Criteria:
  - Request includes `client_turn_id` or equivalent idempotency key.
  - Duplicate submissions do not create duplicate DB writes.
  - Response includes updated state and next prompt.
- Tests to add/run:
  - Integration: `tests/integration/edge-ai-onboarding-idempotency.test.ts`.
- Evidence to attach:
  - Logs showing duplicate submit returns same result.

## TASK-018: Implement persistence of incremental structured answers (draft vs finalized)

- Description: Store partial answers during onboarding without marking the brain "complete" until schema requirements are satisfied.
- Mapped Requirements: REQ-013, REQ-031
- Dependencies: TASK-011, TASK-006
- Files to touch:
  - `supabase/functions/ai-onboarding/index.ts`
  - `supabase/migrations/YYYYMMDDHHMMSS_add_onboarding_draft_fields.sql`
- Acceptance Criteria:
  - Partial answers are persisted in a draft location with tenant scoping.
  - A module is only marked complete when required fields validate.
  - Draft writes are observable (spans + audit rows).
- Tests to add/run:
  - Integration: `tests/integration/edge-ai-onboarding-draft-persist.test.ts`.
- Evidence to attach:
  - DB query output showing draft progression.

## TASK-019: Add onboarding completion transaction (status + final brain write)

- Description: Finalize onboarding completion in a single consistent operation: finalize brain JSON, set status complete, record timestamps.
- Mapped Requirements: REQ-028, REQ-031
- Dependencies: TASK-018
- Files to touch:
  - `supabase/functions/ai-onboarding/index.ts`
  - `supabase/migrations/YYYYMMDDHHMMSS_complete_onboarding_rpc.sql` (optional RPC)
- Acceptance Criteria:
  - Completion sets `ai_onboarding_status.status = "complete"` and `completed_at`.
  - Final brain JSON is non-null and passes schema validation.
  - Completion is idempotent.
- Tests to add/run:
  - Integration: `tests/integration/edge-ai-onboarding-complete.test.ts`.
- Evidence to attach:
  - DB rows proving complete state + final JSON present.

## TASK-020: Trigger cache invalidation on onboarding completion

- Description: Implement cache invalidation for assistant prompt/context snapshots after completion.
- Mapped Requirements: REQ-028, REQ-032
- Dependencies: TASK-019
- Files to touch:
  - `src/ai/brains/index.ts`
  - `supabase/functions/ai-onboarding/index.ts`
- Acceptance Criteria:
  - Cache keys include onboarding version/completion timestamp.
  - Completion clears/bumps cache so subsequent calls reload persona/brain context.
  - Cache invalidation is recorded in spans.
- Tests to add/run:
  - Unit: `tests/unit/prompt-cache-invalidation.test.ts`.
- Evidence to attach:
  - Logs showing cache key bump and reload.

## TASK-021: Reload prompt using stored personality traits (persona injection)

- Description: Update prompt assembly to inject name/tone/expertise from the personality vectors layer, defaulting to "Alex".
- Mapped Requirements: REQ-026, REQ-027, REQ-028, REQ-032
- Dependencies: TASK-007, TASK-020
- Files to touch:
  - `src/ai/prompts/chatGeneral.ts`
  - `src/ai/prompts/*` (shared system prompt builder)
- Acceptance Criteria:
  - Default persona is "Alex" when custom traits are absent.
  - After completion, prompts reflect custom name/tone/expertise.
  - Prompt injection is safe and bounded (no untrusted system instructions).
- Tests to add/run:
  - Unit: `tests/unit/persona-injection.test.ts`.
- Evidence to attach:
  - Prompt snapshot diff (sanitized) showing persona change.

## TASK-022: Persist onboarding raw logs and tie to trace IDs

- Description: Store raw chat turns and include `trace_id`/`span_id` references for debugging.
- Mapped Requirements: REQ-015, REQ-029
- Dependencies: TASK-008, TASK-009
- Files to touch:
  - `supabase/functions/ai-onboarding/index.ts`
  - `supabase/migrations/YYYYMMDDHHMMSS_onboarding_logs_trace_fields.sql`
- Acceptance Criteria:
  - Each turn log row stores `trace_id` and latest `span_id`.
  - Logs redact secrets and limit message size.
  - Logs are tenant-scoped and queryable in chronological order.
- Tests to add/run:
  - Integration: `tests/integration/edge-ai-onboarding-turn-logs.test.ts`.
- Evidence to attach:
  - Example log row (redacted) showing trace linkage.

## TASK-023: Integrate `ai_runs` logging for onboarding model calls

- Description: Ensure every onboarding model call writes an `ai_runs` row with consistent fields.
- Mapped Requirements: REQ-030
- Dependencies: TASK-009
- Files to touch:
  - `src/ai/logging.ts`
  - `supabase/functions/ai-onboarding/index.ts`
- Acceptance Criteria:
  - Each model call inserts `ai_runs` with tokens, latency, provider/model.
  - Unknown responses set `unknown = true` and include reason codes.
  - Insert respects tenant scoping and does not leak raw secrets.
- Tests to add/run:
  - Unit: `tests/unit/ai-runs-field-mapping.test.ts`.
- Evidence to attach:
  - SQL query result for `ai_runs` rows created during onboarding.

## TASK-024: Ensure `ai_otel_spans` coverage per onboarding turn

- Description: Emit spans for onboarding request lifecycle and critical sub-stages (auth, resolver, suggestion gen, persistence).
- Mapped Requirements: REQ-029
- Dependencies: TASK-009
- Files to touch:
  - `src/ai/otel.ts`
  - `supabase/functions/ai-onboarding/index.ts`
- Acceptance Criteria:
  - Each request writes at least: `turn_start`, `turn_end` spans.
  - Sub-stage spans include stage labels and latency_ms.
  - Spans are tenant-scoped and queryable by `trace_id`.
- Tests to add/run:
  - Unit: `tests/unit/otel-log-field-mapping.test.ts`.
- Evidence to attach:
  - Example trace query output showing stages and timings.

## TASK-025: Add server-side retrieval guardrails (scoped match RPC only)

- Description: Enforce that retrieval (if used in onboarding) calls only `match_ai_embeddings_scoped` via service_role inside Edge.
- Mapped Requirements: REQ-024, REQ-033
- Dependencies: TASK-009
- Files to touch:
  - `supabase/functions/_shared/rag-index.ts`
  - `supabase/functions/_shared/retrieval.ts`
  - `supabase/functions/ai-onboarding/index.ts`
- Acceptance Criteria:
  - Any retrieval helper defaults to scoped RPC for onboarding.
  - No client code contains `match_ai_embeddings_scoped` references.
  - Privilege assertions remain: execute is service_role only.
- Tests to add/run:
  - Security: extend `supabase/tests/cross-tenant-isolation.sql` privilege checks.
- Evidence to attach:
  - SQL output showing privileges + grep output for client code.

## TASK-026: Define onboarding step/state machine (modules + completion rules)

- Description: Design the onboarding module sequence and completion rules that map to schema requirements and resolver modules.
- Mapped Requirements: REQ-002, REQ-011, REQ-013
- Dependencies: TASK-004, TASK-011
- Files to touch:
  - `docs/blueprints/ai-guided-onboarding/08_data_model_and_persistence.md`
  - `supabase/functions/ai-onboarding/index.ts`
- Acceptance Criteria:
  - Each module defines required fields and an exit condition.
  - Calibration loops are bounded (max attempts or escalation path).
  - Module transitions are deterministic and logged.
- Tests to add/run:
  - Unit: `tests/unit/onboarding-state-machine.test.ts`.
- Evidence to attach:
  - State diagram (ASCII) and test output.

## TASK-027: Implement persona capture steps in onboarding flow

- Description: Add onboarding steps that capture assistant name, tone, and expertise as part of the conversational flow.
- Mapped Requirements: REQ-027
- Dependencies: TASK-026, TASK-007
- Files to touch:
  - `supabase/functions/ai-onboarding/index.ts`
  - `docs/blueprints/ai-guided-onboarding/07_ui_spec_chat_onboarding.md`
- Acceptance Criteria:
  - Steps exist and validate: name non-empty, tone list bounded, expertise text bounded.
  - Saved traits persist and are visible in the returned snapshot.
  - Traits do not overwrite unrelated brain content.
- Tests to add/run:
  - Integration: `tests/integration/edge-ai-onboarding-persona-steps.test.ts`.
- Evidence to attach:
  - Example response payload showing saved traits.

## TASK-028: Create chat onboarding route and page shell

- Description: Add a dedicated route/page for chat onboarding that loads tenant context and renders the onboarding chat UI.
- Mapped Requirements: REQ-003, REQ-001
- Dependencies: TASK-001
- Files to touch:
  - `src/pages/ai/AiOnboardingChat.tsx` (new)
  - `src/App.tsx`
- Acceptance Criteria:
  - Route renders chat UI and requires authentication.
  - Page loads `agency_id` (and optional `client_id`) safely.
  - Route is feature-flagged for gradual rollout.
- Tests to add/run:
  - UI unit: `src/pages/ai/__tests__/AiOnboardingChat.test.tsx` (vitest).
- Evidence to attach:
  - Screenshot of initial chat shell + test output.

## TASK-029: Implement Message Stream component (markdown + JSON render)

- Description: Build the message stream UI with safe markdown rendering and explicit JSON block rendering.
- Mapped Requirements: REQ-004
- Dependencies: TASK-028
- Files to touch:
  - `src/components/onboarding-chat/MessageStream.tsx` (new)
  - `src/components/onboarding-chat/MessageBubble.tsx` (new)
- Acceptance Criteria:
  - Messages render in chronological order and are read-only.
  - Markdown rendering is safe (no script injection).
  - JSON outputs render in a distinct panel with copy-to-clipboard.
- Tests to add/run:
  - UI unit: `src/components/onboarding-chat/__tests__/MessageStream.test.tsx`.
- Evidence to attach:
  - Screenshot showing markdown + JSON rendering.

## TASK-030: Implement Adaptive Input Field with type-aware validation

- Description: Create an input component that adapts to the backend-provided `expects` and constraint spec.
- Mapped Requirements: REQ-005
- Dependencies: TASK-028
- Files to touch:
  - `src/components/onboarding-chat/AdaptiveInput.tsx` (new)
  - `src/lib/validation/onboardingInput.ts` (new)
- Acceptance Criteria:
  - Supports: short text, textarea, url, single_select, multi_select, contact_card.
  - Validation errors render inline and do not clear draft.
  - Enter/Shift+Enter behavior matches chat UX expectations.
- Tests to add/run:
  - Unit: `src/lib/validation/__tests__/onboardingInput.test.ts`.
- Evidence to attach:
  - Test output + screenshot of error state.

## TASK-031: Implement Suggestion Chip Tray (3-4 suggestions)

- Description: Build chip tray UI with horizontal scroll and stable layout.
- Mapped Requirements: REQ-006, REQ-007
- Dependencies: TASK-028
- Files to touch:
  - `src/components/onboarding-chat/SuggestionChips.tsx` (new)
- Acceptance Criteria:
  - Renders exactly 3-4 chips when provided.
  - Layout supports overflow scroll and keyboard focus.
  - Chips show loading placeholder while suggestions are generating.
- Tests to add/run:
  - UI unit: `src/components/onboarding-chat/__tests__/SuggestionChips.test.tsx`.
- Evidence to attach:
  - Screenshot showing chip tray with 4 chips.

## TASK-032: Implement tap-to-autofill behavior

- Description: Clicking a suggestion hydrates the adaptive input without sending.
- Mapped Requirements: REQ-009
- Dependencies: TASK-030, TASK-031
- Files to touch:
  - `src/pages/ai/AiOnboardingChat.tsx`
  - `src/components/onboarding-chat/SuggestionChips.tsx`
- Acceptance Criteria:
  - Autofill updates draft value and preserves cursor position where possible.
  - Draft can be edited and then submitted normally.
  - Autofill emits a UI analytics event (optional).
- Tests to add/run:
  - UI unit: `src/pages/ai/__tests__/AiOnboardingChat.test.tsx`.
- Evidence to attach:
  - Screen recording showing autofill then edit then send.

## TASK-033: Implement tap-to-send behavior (immediate POST)

- Description: Clicking "send" on a chip submits to `ai-onboarding` and advances the turn.
- Mapped Requirements: REQ-009
- Dependencies: TASK-032, TASK-017
- Files to touch:
  - `src/pages/ai/AiOnboardingChat.tsx`
  - `src/lib/api/aiOnboarding.ts` (new)
- Acceptance Criteria:
  - Tap-to-send triggers POST with idempotency key.
  - UI shows loading state and disables duplicate send.
  - Response appends assistant message and updates suggestions.
- Tests to add/run:
  - Integration (UI): `src/pages/ai/__tests__/AiOnboardingChat.integration.test.tsx` (msw mocked).
- Evidence to attach:
  - Network log + screenshot of loading state.

## TASK-034: Implement message streaming UI state (optional)

- Description: Support streamed deltas if the endpoint supports streaming; otherwise render non-streamed responses consistently.
- Mapped Requirements: REQ-003
- Dependencies: TASK-029, TASK-033
- Files to touch:
  - `src/pages/ai/AiOnboardingChat.tsx`
  - `supabase/functions/ai-onboarding/index.ts`
- Acceptance Criteria:
  - Streaming mode appends deltas to the assistant message bubble.
  - Non-streamed mode uses a single final message payload.
  - UI offers retry on network failure.
- Tests to add/run:
  - UI unit: `src/pages/ai/__tests__/AiOnboardingChat.streaming.test.tsx`.
- Evidence to attach:
  - Screenshot or log showing streamed delta behavior.

## TASK-035: Add onboarding error handling (retry + safe fallbacks)

- Description: Define UI error states for 4xx validation errors, 5xx errors, and timeouts; support retry without losing state.
- Mapped Requirements: REQ-005, REQ-018
- Dependencies: TASK-033
- Files to touch:
  - `src/pages/ai/AiOnboardingChat.tsx`
  - `src/components/onboarding-chat/ErrorBanner.tsx` (new)
- Acceptance Criteria:
  - Validation errors display actionable messages.
  - Retry preserves the message stream and draft.
  - Unknown responses are rendered as recoverable prompts.
- Tests to add/run:
  - UI unit: `src/pages/ai/__tests__/AiOnboardingChat.errors.test.tsx`.
- Evidence to attach:
  - Screenshots of each error state.

## TASK-036: Implement onboarding state persistence in the browser (resume)

- Description: Persist minimal client-side state (turn cursor, draft) so users can resume after reload without duplicating server writes.
- Mapped Requirements: REQ-001
- Dependencies: TASK-028
- Files to touch:
  - `src/lib/storage/onboardingChatState.ts` (new)
  - `src/pages/ai/AiOnboardingChat.tsx`
- Acceptance Criteria:
  - Reload restores last known state without duplicating sends.
  - State is scoped to `agency_id` (and `client_id` if present).
  - Clear state on completion.
- Tests to add/run:
  - Unit: `src/lib/storage/__tests__/onboardingChatState.test.ts`.
- Evidence to attach:
  - Demo steps + localStorage keys screenshot.

## TASK-037: Add UI hook for calling `ai-onboarding` endpoint

- Description: Create a client-side API wrapper and hook that calls Supabase functions invoke and handles typed responses.
- Mapped Requirements: REQ-019, REQ-020
- Dependencies: TASK-010, TASK-033
- Files to touch:
  - `src/lib/api/aiOnboarding.ts`
  - `src/hooks/useAiOnboarding.ts` (new)
- Acceptance Criteria:
  - Calls Supabase Functions invoke with auth.
  - Validates response shape and normalizes errors.
  - Exposes `sendMessage`, `sendSuggestion`, and `retryLast`.
- Tests to add/run:
  - Unit: `src/hooks/__tests__/useAiOnboarding.test.ts`.
- Evidence to attach:
  - Hook test output.

## TASK-038: Implement structured JSON preview panel in chat UI

- Description: Render the "current Agency Brain JSON state" alongside chat, updating each turn.
- Mapped Requirements: REQ-004, REQ-008
- Dependencies: TASK-029, TASK-037
- Files to touch:
  - `src/components/onboarding-chat/BrainStatePanel.tsx` (new)
- Acceptance Criteria:
  - Panel renders current JSON snapshot (read-only).
  - JSON view supports expand/collapse and copy.
  - Panel updates only when snapshot version changes (perf).
- Tests to add/run:
  - UI unit: `src/components/onboarding-chat/__tests__/BrainStatePanel.test.tsx`.
- Evidence to attach:
  - Screenshot of panel updating across turns.

## TASK-039: Ensure backend response includes current brain snapshot every turn

- Description: Include current JSON state of the Agency Brain in each onboarding response to support safe suggestion derivation and UI preview.
- Mapped Requirements: REQ-008
- Dependencies: TASK-016
- Files to touch:
  - `supabase/functions/ai-onboarding/index.ts`
- Acceptance Criteria:
  - Response includes `current_state_json` and `current_state_version`.
  - Snapshot is tenant-scoped and redacted where needed.
  - Suggestions are derived from the same snapshot version.
- Tests to add/run:
  - Integration: `tests/integration/edge-ai-onboarding-snapshot-echo.test.ts`.
- Evidence to attach:
  - Example payload (redacted) showing snapshot fields.

## TASK-040: Implement write path for finalized structured answers (schema-validated)

- Description: Define and implement where the finalized schema-validated answers are persisted as JSON.
- Mapped Requirements: REQ-015, REQ-031
- Dependencies: TASK-018, TASK-026
- Files to touch:
  - `supabase/functions/ai-onboarding/index.ts`
  - `supabase/functions/ai-brains-agency/index.ts` (if used)
  - `supabase/functions/ai-brains-client/index.ts` (if used)
- Acceptance Criteria:
  - Final structured answers are written only after schema validation.
  - Writes are tenant-scoped and auditable (updated_at, version).
  - Read path can assemble the full brain snapshot deterministically.
- Tests to add/run:
  - Integration: `tests/integration/edge-ai-onboarding-final-write.test.ts`.
- Evidence to attach:
  - DB query output showing final JSON.

## TASK-041: Implement `ai-brain-ingest` trigger from onboarding completion

- Description: On completion, call `ai-brain-ingest` to write a summary document and embeddings for retrieval.
- Mapped Requirements: REQ-021, REQ-023
- Dependencies: TASK-019, TASK-040
- Files to touch:
  - `supabase/functions/ai-onboarding/index.ts`
  - `supabase/functions/ai-brain-ingest/index.ts`
- Acceptance Criteria:
  - Ingest is called with `agency_id` and the final answers payload.
  - Ingest writes `ai_documents` + `ai_document_chunks`.
  - Failures are logged; policy is explicit (fail-soft vs fail-hard).
- Tests to add/run:
  - Integration: `tests/integration/edge-ai-brain-ingest-on-complete.test.ts`.
- Evidence to attach:
  - DB evidence: inserted `ai_documents` row and chunk count.

## TASK-042: Ensure dual embeddings written (1536 + 768 shadow)

- Description: Verify and enforce dual-embedding writes for onboarding artifacts when shadow is enabled.
- Mapped Requirements: REQ-023
- Dependencies: TASK-041
- Files to touch:
  - `supabase/functions/_shared/embedding-store.ts`
  - `supabase/functions/ai-brain-ingest/index.ts`
- Acceptance Criteria:
  - Each chunk writes to `ai_embeddings` and `ai_embeddings_shadow_gemini_vector` (when enabled).
  - Dimension checks are enforced and errors are surfaced.
  - Shadow writes can be toggled via env flag.
- Tests to add/run:
  - Unit: `supabase/functions/_shared/__tests__/embedding-store.test.ts`.
- Evidence to attach:
  - SQL queries showing both embedding tables populated for the same chunk IDs.

## TASK-043: Add onboarding completion UI handling (status + redirect)

- Description: On completion, display success, clear local state, and optionally redirect to AI setup page.
- Mapped Requirements: REQ-022, REQ-028
- Dependencies: TASK-019, TASK-028
- Files to touch:
  - `src/pages/ai/AiOnboardingChat.tsx`
  - `src/pages/agency/AISetup.tsx`
- Acceptance Criteria:
  - UI detects completion status in response.
  - State is cleared and user is guided to AI setup or next step.
  - Completion path is resilient to refresh.
- Tests to add/run:
  - UI unit: `src/pages/ai/__tests__/AiOnboardingChat.completion.test.tsx`.
- Evidence to attach:
  - Screenshot of completion screen + redirect behavior.

## TASK-044: Update AI setup page to load persona traits and brain JSON

- Description: Ensure AI setup UI shows the updated brain traits and persona after onboarding completion.
- Mapped Requirements: REQ-022, REQ-032
- Dependencies: TASK-021, TASK-040
- Files to touch:
  - `src/pages/agency/AISetup.tsx`
  - `src/lib/ai/*` (brain fetch helpers)
- Acceptance Criteria:
  - Persona name/tone/expertise renders from canonical source.
  - Structured answers render consistently with stored schema.
  - Loading/error states are clear and tenant-safe.
- Tests to add/run:
  - UI unit: `src/pages/agency/__tests__/AISetup.persona.test.tsx`.
- Evidence to attach:
  - Screenshot showing updated persona and answers.

## TASK-045: Add tenant isolation assertions for onboarding read/write paths

- Description: Add explicit tests that all onboarding reads/writes require correct agency membership and do not leak across tenants.
- Mapped Requirements: REQ-014, REQ-025
- Dependencies: TASK-006, TASK-008, TASK-009
- Files to touch:
  - `supabase/tests/cross-tenant-isolation.sql`
  - `tests/security/edge-tenant-mismatch.test.ts`
- Acceptance Criteria:
  - Forced tenant mismatch attempts return 403 or 0 rows.
  - SQL tests confirm RLS on new onboarding tables.
  - Evidence artifacts are reproducible in CI.
- Tests to add/run:
  - Security: `supabase/tests/cross-tenant-isolation.sql`.
  - Integration: `tests/security/edge-tenant-mismatch.test.ts`.
- Evidence to attach:
  - SQL output + integration test logs.

## TASK-046: Ensure browser never calls `match_ai_embeddings_scoped`

- Description: Add a guard test that fails if client code references the scoped match RPC.
- Mapped Requirements: REQ-024
- Dependencies: TASK-025
- Files to touch:
  - `tests/security/no-client-rpc-match-scoped.test.ts`
- Acceptance Criteria:
  - Test scans `src/` and fails on any `match_ai_embeddings_scoped` reference.
  - Exception list (if any) is explicit and minimal.
  - Test runs in CI.
- Tests to add/run:
  - Security: `tests/security/no-client-rpc-match-scoped.test.ts`.
- Evidence to attach:
  - Test run output.

## TASK-047: Add onboarding observability dashboard queries

- Description: Create SQL snippets and dashboard definitions to query spans/runs for onboarding turns.
- Mapped Requirements: REQ-029, REQ-030
- Dependencies: TASK-024, TASK-023
- Files to touch:
  - `docs/blueprints/ai-guided-onboarding/06_observability_plan.md`
- Acceptance Criteria:
  - Queries include: p95 latency per stage, error rate, repair-pass rate, calibration loops per module.
  - Queries are tenant-safe and filterable by time window.
  - SLO thresholds are specified.
- Tests to add/run:
  - Unit: `tests/unit/otel-trace-schema.test.ts` (ensure required fields exist).
- Evidence to attach:
  - SQL query outputs from staging.

## TASK-048: Implement structured evidence artifact collection checklist

- Description: Standardize evidence artifacts required per task (logs, screenshots, SQL outputs) and store locations.
- Mapped Requirements: REQ-033
- Dependencies: TASK-002
- Files to touch:
  - `docs/blueprints/ai-guided-onboarding/09_test_plan.md`
- Acceptance Criteria:
  - Evidence checklist covers all DoD items.
  - Each gate has a concrete artifact type and where to store it.
  - Checklist is referenced by release process.
- Tests to add/run:
  - Unit: traceability validator ensures each task lists evidence.
- Evidence to attach:
  - Completed checklist template (empty sample).

## TASK-049: Add onboarding suggestion safety filter ("no new facts")

- Description: Implement a deterministic post-filter that removes suggestions not grounded in current snapshot state.
- Mapped Requirements: REQ-008
- Dependencies: TASK-016, TASK-039
- Files to touch:
  - `supabase/functions/ai-onboarding/index.ts`
  - `supabase/functions/_shared/brain-documents.ts` (if used for snapshot)
- Acceptance Criteria:
  - Filter blocks new proper nouns unless present in snapshot (configurable allowlist).
  - Filter ensures 3-4 suggestions remain; otherwise falls back to safe generic suggestions.
  - Filter decisions are logged (span attribute: filtered_count).
- Tests to add/run:
  - Unit: `tests/unit/suggestion-safety-filter.test.ts`.
- Evidence to attach:
  - Test fixtures demonstrating filtered vs allowed suggestions.

## TASK-050: Add calibration loop metrics (count and time-to-ready)

- Description: Measure calibration loops per module and include in spans/runs metadata.
- Mapped Requirements: REQ-010, REQ-011, REQ-029
- Dependencies: TASK-024, TASK-011
- Files to touch:
  - `supabase/functions/ai-onboarding/index.ts`
  - `docs/blueprints/ai-guided-onboarding/06_observability_plan.md`
- Acceptance Criteria:
  - Each turn records calibration loop count (per module) and time-to-ready metrics.
  - Metrics can be queried from spans/runs.
  - SLOs for calibration loops are defined.
- Tests to add/run:
  - Unit: `tests/unit/onboarding-metrics.test.ts`.
- Evidence to attach:
  - Query output showing calibration metrics columns/attributes.

## TASK-051: Implement onboarding module recap and state echo

- Description: Return a recap of captured information and explicit state echo to help users verify progress.
- Mapped Requirements: REQ-002, REQ-004
- Dependencies: TASK-039, TASK-026
- Files to touch:
  - `supabase/functions/ai-onboarding/index.ts`
  - `src/pages/ai/AiOnboardingChat.tsx`
- Acceptance Criteria:
  - Response includes recap text derived from snapshot (not model hallucination).
  - UI renders recap in the message stream or side panel.
  - Recap updates only when relevant fields change.
- Tests to add/run:
  - Integration: `tests/integration/edge-ai-onboarding-recap.test.ts`.
- Evidence to attach:
  - Example payload showing recap string + source fields list.

## TASK-052: Add security hardening for Edge Function secrets and service_role usage

- Description: Enforce rules for service_role handling: never return secrets, never accept service_role from client, and scope DB calls correctly.
- Mapped Requirements: REQ-024, REQ-025
- Dependencies: TASK-009, TASK-025
- Files to touch:
  - `supabase/functions/_shared/env.ts`
  - `supabase/functions/_shared/endpoint-guard.ts`
  - `docs/blueprints/ai-guided-onboarding/05_security_and_tenant_isolation.md`
- Acceptance Criteria:
  - Service role key only loaded server-side.
  - All DB calls include explicit `agency_id` scoping.
  - Security checklist is codified and referenced in onboarding code review template.
- Tests to add/run:
  - Security: `tests/security/edge-service-role-handling.test.ts`.
- Evidence to attach:
  - Static analysis output + test logs.

## TASK-053: Add UI accessibility pass for chat onboarding components

- Description: Ensure chat onboarding meets accessibility requirements (focus order, ARIA, keyboard interactions).
- Mapped Requirements: REQ-003, REQ-006
- Dependencies: TASK-029, TASK-031
- Files to touch:
  - `src/components/onboarding-chat/*`
- Acceptance Criteria:
  - Keyboard-only navigation works for chips and send actions.
  - Screen reader labels exist for interactive elements.
  - Color contrast meets baseline requirements.
- Tests to add/run:
  - UI: add basic a11y checks in `src/pages/ai/__tests__/AiOnboardingChat.a11y.test.tsx`.
- Evidence to attach:
  - a11y test output + manual checklist.

## TASK-054: Add onboarding E2E test for full completion via chat

- Description: Add an end-to-end test that completes onboarding in the chat UI and verifies completion status.
- Mapped Requirements: REQ-001, REQ-020, REQ-031
- Dependencies: TASK-043
- Files to touch:
  - `tests/e2e/onboarding-chat-complete.spec.ts`
- Acceptance Criteria:
  - Test completes required modules and triggers completion.
  - Test verifies `ai_onboarding_status = "complete"` (via API or DB test harness).
  - Test captures screenshots at key steps.
- Tests to add/run:
  - E2E: `tests/e2e/onboarding-chat-complete.spec.ts`.
- Evidence to attach:
  - E2E run video/screenshots.

## TASK-055: Add E2E test for persona adoption immediately after completion

- Description: Verify that the assistant uses the custom persona in the first post-completion message.
- Mapped Requirements: REQ-028, REQ-032
- Dependencies: TASK-021, TASK-054
- Files to touch:
  - `tests/e2e/onboarding-persona-adoption.spec.ts`
- Acceptance Criteria:
  - Test sets persona traits during onboarding.
  - After completion, sends a new message and asserts persona name/tone is applied.
  - Test records evidence artifacts.
- Tests to add/run:
  - E2E: `tests/e2e/onboarding-persona-adoption.spec.ts`.
- Evidence to attach:
  - Screenshot showing custom assistant name.

## TASK-056: Add integration test for dual-embedding persistence on completion

- Description: Ensure completion triggers embeddings writes and both tables are populated (when shadow enabled).
- Mapped Requirements: REQ-021, REQ-023
- Dependencies: TASK-041, TASK-042
- Files to touch:
  - `tests/integration/edge-onboarding-embeddings.test.ts`
- Acceptance Criteria:
  - Test triggers ingest and verifies rows exist in both embedding tables.
  - Test asserts embedding dimensions and model IDs.
  - Test cleans up tenant-scoped test data.
- Tests to add/run:
  - Integration: `tests/integration/edge-onboarding-embeddings.test.ts`.
- Evidence to attach:
  - SQL query outputs for both embedding tables.

## TASK-057: Add security test: forced agency_id mismatch against `ai-onboarding`

- Description: Attempt to call `ai-onboarding` with a valid token but a different agency_id and verify denial.
- Mapped Requirements: REQ-025, REQ-014
- Dependencies: TASK-009
- Files to touch:
  - `tests/security/edge-ai-onboarding-tenant-mismatch.test.ts`
- Acceptance Criteria:
  - Endpoint returns 403 for mismatched agency membership.
  - No DB writes are created for the target agency.
  - Span logs reflect forbidden outcome without leaking tenant data.
- Tests to add/run:
  - Security: `tests/security/edge-ai-onboarding-tenant-mismatch.test.ts`.
- Evidence to attach:
  - Test logs + DB verification query output.

## TASK-058: Add security test: client_id cross-tenant mismatch (when client scoped)

- Description: If client-scoped onboarding is supported, attempt to use a client_id not belonging to the agency and verify denial.
- Mapped Requirements: REQ-025
- Dependencies: TASK-009
- Files to touch:
  - `tests/security/edge-ai-onboarding-client-mismatch.test.ts`
- Acceptance Criteria:
  - Endpoint returns 403 or 404 without revealing existence of the client.
  - No onboarding status/logs are written.
  - Evidence is captured.
- Tests to add/run:
  - Security: `tests/security/edge-ai-onboarding-client-mismatch.test.ts`.
- Evidence to attach:
  - Response payload + DB query output.

## TASK-059: Add server-side validation for URLs and contact cards (adaptive input)

- Description: Enforce backend validation parity for URL/contact-card fields in addition to client-side validation.
- Mapped Requirements: REQ-005, REQ-013
- Dependencies: TASK-010
- Files to touch:
  - `supabase/functions/ai-onboarding/index.ts`
- Acceptance Criteria:
  - URL fields require valid URL format.
  - Contact card requires minimal fields (name + email or phone).
  - Validation failures return 400 with stable error codes.
- Tests to add/run:
  - Integration: `tests/integration/edge-ai-onboarding-validation.test.ts`.
- Evidence to attach:
  - Example 400 payloads for invalid inputs.

## TASK-060: Add "AI-guided interview" prompt library for onboarding modules

- Description: Create or refine prompt builders for onboarding modules to support deep probing and personalization.
- Mapped Requirements: REQ-002, REQ-012
- Dependencies: TASK-026
- Files to touch:
  - `src/ai/prompts/onboarding/*` (new)
  - `src/ai/taskRegistry.ts`
- Acceptance Criteria:
  - Each module has a prompt builder that accepts the current snapshot.
  - Prompt builders have clear system/user separation and no unsafe instructions.
  - Prompt builders are versioned or named consistently.
- Tests to add/run:
  - Unit: `tests/unit/onboarding-prompt-library.test.ts`.
- Evidence to attach:
  - Prompt snapshots (sanitized) for 2-3 modules.

## TASK-061: Add module-level JSON schema definitions for onboarding outputs

- Description: Define schemas for structured outputs required by onboarding modules and register them in the task registry.
- Mapped Requirements: REQ-016, REQ-017
- Dependencies: TASK-060
- Files to touch:
  - `src/ai/schema.ts`
  - `src/ai/taskRegistry.ts`
- Acceptance Criteria:
  - Schemas cover required module fields and types.
  - Repair pass is validated against these schemas.
  - Unknown build paths exist for strict_unknown tasks.
- Tests to add/run:
  - Unit: `tests/unit/schema-contract-coverage.test.ts` (extend) and add new schema tests.
- Evidence to attach:
  - Schema coverage report output.

## TASK-062: Add UI spec compliance test for 3-4 suggestions per prompt

- Description: Ensure UI tests fail if the backend returns fewer/more than 3-4 suggestions for input turns.
- Mapped Requirements: REQ-007
- Dependencies: TASK-031, TASK-037
- Files to touch:
  - `src/pages/ai/__tests__/AiOnboardingChat.suggestions.test.tsx`
- Acceptance Criteria:
  - Test suite asserts chips length is 3 or 4 when `expects` indicates input is required.
  - UI gracefully handles 0 suggestions only in explicit error mode.
  - Contract mismatch produces actionable error output.
- Tests to add/run:
  - UI unit: `src/pages/ai/__tests__/AiOnboardingChat.suggestions.test.tsx`.
- Evidence to attach:
  - Test output.

## TASK-063: Add integration test for `match_ai_embeddings_scoped` privilege hardening

- Description: Verify at runtime that `authenticated` cannot execute `match_ai_embeddings_scoped`, and only `service_role` can.
- Mapped Requirements: REQ-024, REQ-033
- Dependencies: TASK-025
- Files to touch:
  - `supabase/tests/cross-tenant-isolation.sql`
  - `tests/security/rpc-privilege-match-scoped.test.ts`
- Acceptance Criteria:
  - Attempted execute as `authenticated` fails.
  - Attempted execute via Edge service_role succeeds and returns scoped results.
  - Evidence is attached.
- Tests to add/run:
  - Security: `tests/security/rpc-privilege-match-scoped.test.ts`.
- Evidence to attach:
  - SQL outputs + integration logs.

## TASK-064: Add cache reload verification test (persona gate)

- Description: Ensure onboarding completion triggers prompt cache invalidation and reload.
- Mapped Requirements: REQ-028, REQ-032
- Dependencies: TASK-020, TASK-021
- Files to touch:
  - `tests/integration/prompt-cache-reload-on-complete.test.ts`
- Acceptance Criteria:
  - Test captures cache key before completion and after completion and asserts it changes.
  - Test confirms new prompt includes custom persona.
  - Evidence includes logs and test output.
- Tests to add/run:
  - Integration: `tests/integration/prompt-cache-reload-on-complete.test.ts`.
- Evidence to attach:
  - Logs showing invalidation + reload.

## TASK-065: Add DB-level constraints/checks for onboarding status and persona traits

- Description: Add constraints for allowed status values and basic trait bounds to prevent corrupt state.
- Mapped Requirements: REQ-028, REQ-026, REQ-027
- Dependencies: TASK-006, TASK-007
- Files to touch:
  - `supabase/migrations/YYYYMMDDHHMMSS_onboarding_constraints.sql`
- Acceptance Criteria:
  - Status is constrained to allowed values (e.g., draft, in_progress, complete).
  - Persona name is non-empty when status is complete (if required).
  - Constraints do not block legitimate partial onboarding.
- Tests to add/run:
  - DB: add constraint checks in `tests/integration/db-constraints-onboarding.test.ts`.
- Evidence to attach:
  - Migration output + failing insert example (expected).

## TASK-066: Add release checklist for onboarding security and DoD evidence

- Description: Create a release checklist that enumerates required evidence artifacts for DoD gates.
- Mapped Requirements: REQ-031, REQ-032, REQ-033
- Dependencies: TASK-048, TASK-045
- Files to touch:
  - `docs/blueprints/ai-guided-onboarding/09_test_plan.md`
  - `docs/blueprints/ai-guided-onboarding/05_security_and_tenant_isolation.md`
- Acceptance Criteria:
  - Checklist covers: completion state, persona adoption, scoped retrieval, observability, suggestion contract.
  - Checklist references concrete tests and where evidence is stored.
  - Checklist is ASCII-only and copy/paste-friendly.
- Tests to add/run:
  - Unit: traceability validator ensures DoD evidence entries exist.
- Evidence to attach:
  - Completed checklist for staging release.

## TASK-067: Add performance test for onboarding turn latency

- Description: Benchmark p95 latency for onboarding turns under typical load and validate against SLOs.
- Mapped Requirements: REQ-029, REQ-030
- Dependencies: TASK-024
- Files to touch:
  - `tests/perf/onboarding-turn-latency.test.ts`
  - `docs/blueprints/ai-guided-onboarding/06_observability_plan.md`
- Acceptance Criteria:
  - Test measures p95 end-to-end latency for a set of turns.
  - Results are compared to SLO targets and reported.
  - Regression threshold triggers failure.
- Tests to add/run:
  - Perf: `tests/perf/onboarding-turn-latency.test.ts`.
- Evidence to attach:
  - Perf report output.

## TASK-068: Add repair-pass rate monitoring and alert threshold

- Description: Add monitoring for repair-pass usage and set alert thresholds for anomalous increases.
- Mapped Requirements: REQ-017, REQ-029
- Dependencies: TASK-013, TASK-047
- Files to touch:
  - `docs/blueprints/ai-guided-onboarding/06_observability_plan.md`
- Acceptance Criteria:
  - Repair-pass rate is computed from runs/spans.
  - Alert threshold is defined (e.g., > 8% over 1h rolling window).
  - Runbook describes mitigation steps (prompt/schema adjustments).
- Tests to add/run:
  - Unit: `tests/unit/otel-trace-schema.test.ts` (ensure attributes exist).
- Evidence to attach:
  - Query output computing repair-pass rate.

## TASK-069: Add calibration-needed UX (UI prompt + state)

- Description: Render calibration-needed state clearly and allow users to answer follow-up questions without losing progress.
- Mapped Requirements: REQ-011, REQ-010
- Dependencies: TASK-035, TASK-011
- Files to touch:
  - `src/pages/ai/AiOnboardingChat.tsx`
  - `src/components/onboarding-chat/CalibrationNotice.tsx` (new)
- Acceptance Criteria:
  - UI displays which fields are missing (human-readable descriptions) when provided.
  - User answers follow-up question and state advances on success.
  - UI records evidence events for calibration loops.
- Tests to add/run:
  - UI unit: `src/pages/ai/__tests__/AiOnboardingChat.calibration.test.tsx`.
- Evidence to attach:
  - Screenshot of calibration-needed UX.

## TASK-070: Add "0 cross-tenant leaks" regression suite for onboarding

- Description: Bundle SQL + Edge integration tests into a single regression suite executed on every release.
- Mapped Requirements: REQ-014, REQ-025, REQ-033
- Dependencies: TASK-045, TASK-057, TASK-063
- Files to touch:
  - `tests/security/onboarding-zero-leaks-suite.test.ts`
- Acceptance Criteria:
  - Suite covers: RLS tables, Edge membership checks, RPC privilege checks.
  - Suite runs in CI and is deterministic.
  - Failures are clearly attributed to a single check.
- Tests to add/run:
  - Security: `tests/security/onboarding-zero-leaks-suite.test.ts`.
- Evidence to attach:
  - CI run logs for the suite.

## TASK-071: Add suggestion derivation evidence logging (source fields)

- Description: Log which snapshot fields were used to generate each suggestion (for auditability), without logging sensitive content.
- Mapped Requirements: REQ-008, REQ-029
- Dependencies: TASK-016
- Files to touch:
  - `supabase/functions/ai-onboarding/index.ts`
  - `docs/blueprints/ai-guided-onboarding/06_observability_plan.md`
- Acceptance Criteria:
  - Each response includes (or logs) `suggestion_sources` as a list of JSON paths used.
  - Logs do not include raw PII beyond allowed fields.
  - Evidence can be queried by trace_id.
- Tests to add/run:
  - Integration: `tests/integration/edge-ai-onboarding-suggestion-sources.test.ts`.
- Evidence to attach:
  - Span attribute example showing source paths.

## TASK-072: Final hardening pass (DoD gates) and staging sign-off

- Description: Run all defined tests, ensure coverage gates pass, and produce the evidence bundle for release.
- Mapped Requirements: REQ-031, REQ-032, REQ-033
- Dependencies: TASK-054, TASK-055, TASK-070, TASK-005
- Files to touch:
  - `docs/blueprints/ai-guided-onboarding/02_traceability_matrix.md`
  - `docs/blueprints/ai-guided-onboarding/09_test_plan.md`
- Acceptance Criteria:
  - Coverage gate: 100% REQs present in traceability matrix.
  - Test gate: 100% REQs have at least one test listed in test plan.
  - Security gate: no client RPC calls; scoped retrieval only via Edge + service_role.
  - Persona gate: completion triggers status complete + cache invalidation + prompt reload.
  - Suggestion gate: every prompt returns 3-4 suggestions derived from snapshot.
- Tests to add/run:
  - Run: unit + integration + security + e2e suites.
- Evidence to attach:
  - Full evidence bundle: SQL outputs, logs, screenshots, and CI run links.
