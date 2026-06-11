# Requirements Catalog (Exhaustive)

Source of truth: `docs/report/The AI-Guided Agency Onboarding Ecosystem.md`.

Conventions:
- Stable IDs: `REQ-001`, `REQ-002`, ... with no gaps.
- Owners: `UI`, `Edge`, `DB`, `AI-Core`.

## REQ-001: Conversational ingestion replaces static forms

- Requirement: Deprecate traditional form-based onboarding in favor of a conversational ingestion model for onboarding.
- Rationale: Conversational beats reduce friction and enable higher-fidelity capture than static forms.
- Acceptance Criteria:
  - Users can complete onboarding without any multi-page static form UI for the AI-guided path.
  - Onboarding progresses as a turn-based dialogue where each user submission advances or calibrates the state.
- Primary Owner: UI

## REQ-002: Transitionary onboarding phase produces deep understanding

- Requirement: Implement a transitionary onboarding phase as an AI-guided interview that probes operational nuances and produces a "Deep Understanding" layer.
- Rationale: The onboarding phase is the architectural foundation for long-term agency partnership and personalization.
- Acceptance Criteria:
  - The onboarding flow includes follow-up probing when answers are missing/ambiguous.
  - The stored output is usable as a durable context layer for later AI tasks.
- Primary Owner: Edge

## REQ-003: Professional chat interface is required

- Requirement: Provide a high-end chat interface for onboarding to mitigate user friction during dense information entry.
- Rationale: Chat reduces cognitive load by splitting complex data entry into manageable beats.
- Acceptance Criteria:
  - The AI onboarding UI is presented as a chat, not a wizard-like checklist or static form.
  - The UI supports incremental progression with clear turn boundaries and state.
- Primary Owner: UI

## REQ-004: Message Stream component

- Requirement: Implement a chronological, read-only message stream that supports markdown-rendered text and structured JSON outputs.
- Rationale: Users must see the conversation history and inspect structured outputs as they evolve.
- Acceptance Criteria:
  - Assistant messages render markdown safely.
  - When assistant output includes structured JSON, it is rendered in a distinct structured view (not plain text).
- Primary Owner: UI

## REQ-005: Adaptive Input Field component

- Requirement: Implement a dynamic input field that adjusts validation rules based on the expected data type (e.g., text vs contact card).
- Rationale: Type-aware validation improves data quality and reduces calibration loops.
- Acceptance Criteria:
  - The UI enforces min/max/pattern constraints per step when provided by the backend.
  - Invalid input produces a clear validation error without losing the draft content.
- Primary Owner: UI

## REQ-006: Suggestion Chip Tray component

- Requirement: Implement a horizontal scroll tray for pre-calculated response suggestions.
- Rationale: Suggestion chips reduce friction and accelerate completion.
- Acceptance Criteria:
  - The tray displays 3-4 suggestions per assistant prompt.
  - Chips are tappable/clickable and accessible via keyboard navigation.
- Primary Owner: UI

## REQ-007: Every AI prompt returns 3-4 personalized suggestions

- Requirement: The system must generate 3-4 personalized answer suggestions for every AI prompt during onboarding.
- Rationale: Consistent suggestion availability improves onboarding throughput and UX predictability.
- Acceptance Criteria:
  - For every assistant prompt that expects user input, the response payload includes 3-4 suggestions.
  - Suggestions are non-empty strings and are unique (no duplicates).
- Primary Owner: Edge

## REQ-008: Suggestion generation must use current Agency Brain JSON state

- Requirement: Suggestion prompts must include the current JSON state of the Agency Brain, and suggestions must be derived from previously captured data to prevent hallucination.
- Rationale: Hallucinated suggestions can poison the brain dataset and degrade trust.
- Acceptance Criteria:
  - Suggestion generation input includes the current brain JSON snapshot for the tenant scope.
  - A deterministic guard prevents suggestions that introduce unknown proper nouns or facts not present in the snapshot (or explicitly labels them as "unknown" and excludes them from suggestions).
- Primary Owner: Edge

## REQ-009: Suggestion interaction - tap-to-autofill and tap-to-send

- Requirement: Support both tap-to-autofill (hydrate input for editing) and tap-to-send (immediate POST to `ai-onboarding` endpoint).
- Rationale: Users need both quick progression and the ability to refine suggested text.
- Acceptance Criteria:
  - Tap-to-autofill populates the input field without sending.
  - Tap-to-send submits the suggestion as the user input and advances the onboarding turn.
- Primary Owner: UI

## REQ-010: Adaptive probing uses `src/ai/brainResolver.ts`

- Requirement: The onboarding system must analyze the current dataset against the defined schema using the logic in `src/ai/brainResolver.ts`.
- Rationale: Adaptive probing ensures data completeness and quality.
- Acceptance Criteria:
  - Each turn triggers a resolver evaluation and returns either `ready` or `calibration_needed`.
  - Calibration questions are generated for missing/ambiguous required fields.
- Primary Owner: AI-Core

## REQ-011: State resolution behavior for `ready` vs `calibration_needed`

- Requirement: If resolver returns `ready`, the AI progresses to the next module; if `calibration_needed`, the AI generates a follow-up question targeting missing fields.
- Rationale: The state machine prevents progression with incomplete data.
- Acceptance Criteria:
  - The backend response indicates the state (`ready` or `calibration_needed`) and includes the next prompt or calibration question.
  - The calibration path persists partial answers without finalizing the module.
- Primary Owner: Edge

## REQ-012: Agency-aware questioning

- Requirement: Transform standard onboarding questions into personalized prompts using captured variables (e.g., agency name, niche).
- Rationale: Personalization increases engagement and reduces ambiguous answers.
- Acceptance Criteria:
  - Prompts contain resolved placeholders (e.g., "[Agency Name]") once values exist.
  - When values do not exist, prompts fall back to generic phrasing without inserting fabricated values.
- Primary Owner: Edge

## REQ-013: Data integrity tied to structured storage

- Requirement: Interaction logic must be strictly coupled to structured storage requirements such that only validated outcomes persist.
- Rationale: Prevents storing invalid or unverified data in the brain.
- Acceptance Criteria:
  - Schema-validated outputs are required before marking a module complete.
  - Invalid outputs trigger repair and/or calibration, not silent persistence.
- Primary Owner: AI-Core

## REQ-014: Agency Brain persistence enforces 0 cross-tenant leaks

- Requirement: Data persistence is handled by the Agency Brain module and must maintain the invariant of 0 cross-tenant leaks.
- Rationale: Tenant isolation is a hard security constraint.
- Acceptance Criteria:
  - All reads/writes are scoped by `agency_id` with RLS enforcement and membership checks.
  - Automated tests demonstrate cross-tenant read attempts return 0 rows.
- Primary Owner: DB

## REQ-015: Agency Brain has 3 layers

- Requirement: The brain stores: (1) personality vectors, (2) JSON structured answers, and (3) raw chat logs.
- Rationale: Separate layers support persona injection, reliable structured retrieval, and episodic context.
- Acceptance Criteria:
  - Personality traits are stored as durable, queryable fields and can be loaded into prompts.
  - Final answers are stored as schema-validated JSON.
  - Raw chat logs are stored with tenant scoping and can be replayed for audits/debugging.
- Primary Owner: DB

## REQ-016: Schema enforcement uses `src/ai/router.ts` and `src/ai/taskRegistry.ts`

- Requirement: Use the router and task registry to enforce JSON schema validation for structured AI outputs.
- Rationale: Centralized schema enforcement improves reliability and safety.
- Acceptance Criteria:
  - Structured outputs pass schema validation or trigger the repair pass.
  - Validation failures are observable (logged) and surfaced to the caller as controlled failures.
- Primary Owner: AI-Core

## REQ-017: Repair pass on schema validation failure

- Requirement: If AI output fails schema validation, the router triggers a repair pass to reformat the output.
- Rationale: Repair improves success rates without manual intervention.
- Acceptance Criteria:
  - A second pass is attempted with a "return only valid JSON" instruction.
  - If repair fails, the system returns `UNKNOWN` with a reason code.
- Primary Owner: AI-Core

## REQ-018: `UNKNOWN` fallbacks when context is missing

- Requirement: When required context is missing, the router must return `UNKNOWN` rather than failing silently.
- Rationale: Silent failures break user trust and hide data gaps.
- Acceptance Criteria:
  - Missing required context returns a structured `UNKNOWN` payload.
  - The UI renders a recoverable state and requests missing information.
- Primary Owner: AI-Core

## REQ-019: Onboarding uses Supabase Edge Functions

- Requirement: The onboarding workflow leverages the existing Supabase Edge Function stack for security and performance.
- Rationale: Edge Functions enable server-side policy enforcement and secret management.
- Acceptance Criteria:
  - Onboarding orchestration runs in Edge Functions, not directly in the browser.
  - Client-to-DB writes for onboarding are either via Edge Function or RLS-protected tables with strict scoping.
- Primary Owner: Edge

## REQ-020: `ai-onboarding` endpoint routes user input and plans next step

- Requirement: Provide an `ai-onboarding` Edge Function that performs intent classification and planning/routing to generate the next conversational step.
- Rationale: Central orchestration point ensures consistent behavior and traceability.
- Acceptance Criteria:
  - The endpoint accepts conversation state + latest user message and returns the next assistant message + suggestions + expected input type.
  - The endpoint is versioned and logs each call for observability.
- Primary Owner: Edge

## REQ-021: `ai-brain-ingest` populates documents and chunks

- Requirement: `ai-brain-ingest` (TaskType `EMBED_TEXT`) populates `ai_documents` and `ai_document_chunks`.
- Rationale: RAG-ready storage requires chunking and durable artifact storage.
- Acceptance Criteria:
  - Ingest writes one `ai_documents` row and N chunk rows for a given artifact.
  - Chunking uses bounded token counts and records token metadata.
- Primary Owner: Edge

## REQ-022: AI Setup page reflects updated Agency Brain values

- Requirement: Provide an AI setup page that updates the UI with custom Agency Brain values.
- Rationale: Users must see and manage the result of onboarding.
- Acceptance Criteria:
  - After onboarding completion, the AI setup page loads and renders the stored brain traits and structured answers.
  - Updates are tenant-scoped and consistent with stored sources.
- Primary Owner: UI

## REQ-023: Dual-embedding storage (1536 + 768 shadow)

- Requirement: Store all Agency Brain data in both `ai_embeddings` (1536) and `ai_embeddings_shadow_gemini_vector` (768).
- Rationale: Enables reversible cutover and future-proofing.
- Acceptance Criteria:
  - Each ingested chunk produces both vector types when shadow is enabled.
  - Shadow embedding dimensions are validated (1536 and 768 respectively).
- Primary Owner: Edge

## REQ-024: Scoped retrieval is server-side only using `service_role`

- Requirement: All calls to `match_ai_embeddings_scoped` must be handled within an Edge Function using `service_role` credentials (never client-side).
- Rationale: Prevents direct client exploitation and enforces agency-scoped retrieval.
- Acceptance Criteria:
  - No browser code calls the RPC directly.
  - Database privileges restrict execute to `service_role` and automated tests assert it.
- Primary Owner: Edge

## REQ-025: Tenant scoping enforced by `agency_id` at DB level

- Requirement: Enforce tenant scoping by `agency_id` at the database level; direct access to brain data without validated `agency_id` is a critical failure.
- Rationale: The blueprint requires 0 cross-tenant leaks as a hard invariant.
- Acceptance Criteria:
  - RLS policies on all brain-related tables scope by agency membership.
  - Security tests attempt forced tenant mismatch and prove no data leakage.
- Primary Owner: DB

## REQ-026: Default persona is "Alex"

- Requirement: All instances initialize with the default persona named "Alex".
- Rationale: Provides a stable baseline personality until customization is complete.
- Acceptance Criteria:
  - A new tenant without customization sees "Alex" as the assistant name/tone defaults.
  - The prompt builder uses the default traits when no custom traits exist.
- Primary Owner: AI-Core

## REQ-027: Users configure persona traits during onboarding

- Requirement: During onboarding, users define assistant name, tone, and expertise; these overwrite the default persona in the personality vectors layer.
- Rationale: Custom persona increases agency alignment and adoption.
- Acceptance Criteria:
  - The onboarding flow includes explicit steps to collect these traits.
  - Saved traits are applied to subsequent AI calls for that tenant scope.
- Primary Owner: UI

## REQ-028: On completion, update status, invalidate cache, reload prompt

- Requirement: Upon onboarding completion, the system must (1) update `ai_onboarding_status` to `"complete"`, (2) trigger cache invalidation for the assistant system prompt, and (3) reload the prompt using the stored traits.
- Rationale: Persona adoption must be immediate and consistent.
- Acceptance Criteria:
  - Completion writes status `"complete"` in a tenant-scoped table.
  - A deterministic invalidation path clears any cached prompt/context snapshots for the tenant.
  - The next assistant turn uses the new persona traits (verified by test).
- Primary Owner: Edge

## REQ-029: Log every onboarding interaction to `ai_otel_spans`

- Requirement: Every onboarding interaction must be logged to `ai_otel_spans` for latency and performance metrics.
- Rationale: Enables debugging and SLO monitoring.
- Acceptance Criteria:
  - Each onboarding API request produces at least one span row with trace identifiers and stage labels.
  - Spans include `agency_id` and optional `client_id` for tenant scoping.
- Primary Owner: AI-Core

## REQ-030: Record model calls/outcomes in `ai_runs`

- Requirement: Record structured logs of model calls and outcomes in `ai_runs`.
- Rationale: Debugging the reasoning engine requires durable run history.
- Acceptance Criteria:
  - Each model call made during onboarding inserts an `ai_runs` row.
  - Rows include tokens, latency, success, unknown flag, and provider/model metadata.
- Primary Owner: AI-Core

## REQ-031: DoD - fully validated non-null JSON dataset

- Requirement: The Agency Brain contains a fully validated, non-null JSON dataset after onboarding.
- Rationale: The brain is the durable output of onboarding.
- Acceptance Criteria:
  - Schema validation passes for the final brain JSON.
  - DB rows are present and queryable for the tenant scope.
- Primary Owner: DB

## REQ-032: DoD - immediate persona adoption

- Requirement: The AI assistant successfully adopts the custom name and personality traits immediately after onboarding.
- Rationale: Completion must reflect in subsequent interactions without delay.
- Acceptance Criteria:
  - A post-completion chat message uses the new assistant name/tone.
  - Tests confirm the system prompt content changes after invalidation.
- Primary Owner: AI-Core

## REQ-033: DoD - scoped retrieval proves zero cross-tenant visibility

- Requirement: `match_ai_embeddings_scoped` confirms zero cross-tenant visibility through `service_role` filtered retrieval.
- Rationale: Validates the security invariant for retrieval.
- Acceptance Criteria:
  - Tests attempt to retrieve embeddings outside the agency scope and get 0 results.
  - Evidence includes SQL outputs and integration logs demonstrating correct scoping.
- Primary Owner: DB

