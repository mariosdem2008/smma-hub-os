# AI-Guided Agency Onboarding - Blueprint Overview

## 1. Executive Summary (12-25 lines)

This blueprint defines an AI-guided, conversational onboarding system that replaces static forms with an interview-style chat experience.
The outcome is a durable "Agency Brain" that captures high-fidelity agency context, enabling consistent, personalized AI behavior.
The UI is a professional chat interface with a message stream, adaptive input validation, and a suggestion chip tray.
Every AI prompt must return 3-4 personalized suggestions derived from the current Agency Brain JSON to prevent hallucinations.
Backend orchestration is performed via Supabase Edge Functions to preserve tenant isolation and enforce server-side retrieval.
Adaptive probing is required: each turn must evaluate schema completeness using `src/ai/brainResolver.ts` and either proceed or ask calibrated follow-ups.
All AI outputs that are expected to be structured must be validated via `src/ai/router.ts` + `src/ai/taskRegistry.ts`, using a repair pass on schema failure and `UNKNOWN` fallbacks when context is missing.
Data persistence must support three layers: personality vectors (assistant identity traits), finalized schema-validated JSON, and raw chat logs.
The storage and retrieval path must use dual embeddings: `ai_embeddings` (1536) and `ai_embeddings_shadow_gemini_vector` (768) for cutover readiness.
Cross-tenant leakage is a hard invariant; scoped retrieval (`match_ai_embeddings_scoped`) must only be invoked server-side using `service_role`.
On onboarding completion, the assistant must immediately adopt the configured persona (default "Alex" overridden by user traits), invalidate any prompt cache, and reload the system prompt from stored traits.
Observability is first-class: every onboarding interaction produces `ai_otel_spans`, and all model calls are recorded as `ai_runs`.

## 2. Current State Audit (MANDATORY)

### 2.1 What exists today

#### 2.1.1 AI Core (App)

- EXISTS: `src/ai/brainResolver.ts` (ready vs calibration_needed resolution; uses `brain_documents` approved modules).
- EXISTS: `src/ai/router.ts` (schema enforcement + repair pass; `UNKNOWN` fallbacks; logs `ai_runs` and `ai_otel_spans`).
- EXISTS: `src/ai/taskRegistry.ts` (task configs and schemas; strict/normal unknown safety modes).
- EXISTS: Router export `ai = createAiRouter()` in `src/ai/router.ts` but `useBrainResolver` is disabled by default (gap vs blueprint requirement for adaptive probing in onboarding flow).

#### 2.1.2 Supabase Edge Functions

- EXISTS: `supabase/functions/ai-brain-ingest/index.ts` (writes `ai_documents` + chunks + embeddings; includes dual embedding helpers and shadow Gemini embedding path).
- EXISTS (related but not named per blueprint): `supabase/functions/ai-onboarding-guide/index.ts` (step spec generator and guided flow logic).
- EXISTS (adjacent onboarding utilities): `supabase/functions/ai-onboarding-scan/index.ts`, `supabase/functions/ai-onboarding-suggest/index.ts`.
- GAP: No Edge Function named `ai-onboarding` found in `supabase/functions/` (blueprint calls it out explicitly).

#### 2.1.3 Database (Migrations + RLS)

- EXISTS: `public.ai_documents`, `public.ai_document_chunks`, `public.ai_embeddings (vector(1536))`, `public.ai_runs` in `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql`.
- EXISTS: `public.ai_otel_spans` in `supabase/migrations/20260201001000_add_ai_otel_spans.sql`.
- EXISTS: `public.ai_embeddings_shadow_gemini_vector (vector(768))` in `supabase/migrations/20260202036000_phase2_gemini_shadow_vector_rag.sql`.
- EXISTS: RPC `public.match_ai_embeddings_scoped(...)` in `supabase/migrations/20260202034000_phase2_episodic_memory.sql`.
- EXISTS: Hardening migration restricts match RPCs to `service_role` only: `supabase/migrations/20260202037000_harden_phase2_rag_functions.sql`.
- EXISTS: RLS policies enforcing `agency_id` tenant scoping for `ai_documents`, `ai_document_chunks`, `ai_embeddings`, `ai_runs`, `ai_otel_spans`, `ai_embeddings_shadow_gemini_vector` (via agency membership checks in migrations).
- GAP: No table/object named `ai_onboarding_status` found in migrations (blueprint requires it to be set to "complete").

### 2.2 What is missing (delta vs blueprint)

- Missing `ai-onboarding` Edge Function endpoint that does conversational "intent/planner" routing and turn-by-turn progression.
- Missing chat-based onboarding UI spec/implementation aligned to blueprint (current repo has onboarding wizard flows, but not the required professional chat interface per blueprint).
- Missing explicit persistence spec for the blueprint's 3-layer Agency Brain model mapped to current tables (agency/client brains, brain_documents, ai_documents, chat logs).
- Missing `ai_onboarding_status` persistence + completion semantics (including cache invalidation and prompt reload).
- Missing explicit, enforceable "3-4 suggestions for every AI prompt" contract across onboarding endpoints (some existing endpoints return 5-10 suggestions and do not guarantee derivation from current Agency Brain JSON).
- Missing end-to-end security proof artifacts demonstrating "0 cross-tenant visibility" for onboarding flows (beyond function privilege hardening).

### 2.3 Biggest blockers

1. Naming/contract drift: blueprint expects `ai-onboarding`, but current Edge Functions are split (`ai-onboarding-guide`, `ai-onboarding-scan`, `ai-onboarding-suggest`).
2. Adaptive probing integration: `brainResolver.ts` exists, but the exported router `ai` does not enable it by default and onboarding flows are not contractually tied to it.
3. Data model mismatch: blueprint requires 3-layer brain + `ai_onboarding_status`; current schema has pieces but not an explicit, audited mapping.
4. Suggestion safety: blueprint requires suggestions derived from current brain JSON; existing suggestion generators use partial profile context and can exceed 4 suggestions.

### 2.4 Phase-0 decisions (locked)

1. Endpoint strategy: create a new `ai-onboarding` Edge Function in Phase-2 and keep `ai-onboarding-guide`, `ai-onboarding-scan`, and `ai-onboarding-suggest` unchanged during Phase-0.
2. Contract baseline: freeze a versioned `v1` request/response contract in `07_ui_spec_chat_onboarding.md`.
3. Coverage baseline: treat `scripts/traceability/ai-guided-onboarding.mjs` as the source-of-truth validator for REQ/TASK/test coverage and ASCII checks.
4. CI gate: block merges if the traceability check fails (`npm run traceability:ai-guided-onboarding:check`).

## 3. Non-Goals (Explicit)

1. Rewriting unrelated onboarding flows (e.g., non-AI onboarding wizards) outside the AI-guided chat scope.
2. Building a new general-purpose RAG system beyond the scoped retrieval already defined (`match_ai_embeddings_scoped`).
3. Implementing new model providers; the plan assumes the existing AI router/provider facade remains the integration point.
4. Changing business logic unrelated to onboarding (billing, scheduling, social posting, etc.).

## 4. System Boundaries

### 4.1 Frontend (UI)

- Owns: Chat UI (message stream, adaptive input, suggestion chips), turn submission, streaming display, error/retry UX, persona display.
- Must NOT: Call `match_ai_embeddings_scoped` directly; must NOT use `service_role` secrets.

### 4.2 Edge (Supabase Functions)

- Owns: All server-side AI calls for onboarding orchestration, schema enforcement calls, server-side scoped retrieval, writes to DB, and observability writes.
- Must: Use `service_role` when calling scoped match RPC; enforce agency membership before reading/writing tenant data.

### 4.3 Database (Postgres + RLS)

- Owns: Tenant isolation invariants (RLS), constraints, embedding/vector storage, onboarding completion state, durable audit logs for runs/spans.
- Must: Prevent cross-tenant reads/writes by default (agency_id-scoped policies).

## 5. Final Definition of Done (Blueprint + Measurable Checks)

1. Agency Brain has a fully validated, non-null JSON dataset for the configured scope (agency-level onboarding at minimum).
2. The assistant adopts the configured persona (custom name/tone/expertise) immediately after onboarding completes, without requiring logout/reload.
3. `ai_onboarding_status` is set to `"complete"` and is queryable with tenant scoping enforced by RLS.
4. Cache invalidation occurs on completion and the prompt reloads using stored traits (persona gate).
5. All retrieval via `match_ai_embeddings_scoped` is performed server-side in an Edge Function using `service_role` (security gate).
6. Zero cross-tenant visibility is proven via explicit automated tests (SQL + integration) and logged evidence artifacts.
7. Every onboarding turn emits `ai_otel_spans`, and every model call is recorded in `ai_runs` (observability gate).
8. 100% requirements coverage is proven via the traceability matrix: every `REQ-###` maps to >= 1 `TASK-###`, >= 1 file/module, and >= 1 test.
