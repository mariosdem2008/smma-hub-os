# Data Model and Persistence

This document maps the blueprint's "Agency Brain" requirements to concrete DB objects and read/write paths, with strict tenant isolation.

## 0. Phase-1 implementation status

Implemented in migration:
- `supabase/migrations/20260202038000_phase1_onboarding_state_persona_and_logs.sql`
- `supabase/migrations/20260202039000_phase1_tenant_consistency_hardening.sql`

Created objects:
- `public.ai_onboarding_status`
- `public.ai_persona_vectors`
- `public.ai_onboarding_turn_logs`

Tenant-isolation verification update:
- `supabase/tests/cross-tenant-isolation.sql` now includes RLS checks for all three tables.
- `supabase/tests/cross-tenant-isolation.sql` includes trigger-guard checks for client/agency consistency.

## 0.1 Phase-2 implementation status

Implemented artifacts:
- Edge orchestration endpoint: `supabase/functions/ai-onboarding/index.ts`
- Shared onboarding state logic: `src/ai/onboardingState.ts`
- Endpoint allowlist update: `supabase/functions/_shared/endpoint-guard.ts`
- Guided-task resolver expansion: `src/ai/taskToModuleMap.ts`
- Server mirror update: `supabase/functions/_shared/brain-resolver.ts`
- Idempotency + response persistence migration: `supabase/migrations/20260205091000_phase2_onboarding_turn_idempotency_and_response_payload.sql`

Runtime behavior now in place:
- `ai-onboarding` uses service-role Edge execution with auth and agency membership checks.
- Resolver-enabled routing is instantiated only for onboarding path (`useBrainResolver: true`).
- Contract enforces 3-4 suggestions for each turn response.
- `ai_onboarding_status`, `ai_onboarding_turn_logs`, and `ai_runs` are written per turn.

## 1. Agency Brain 3-layer model (tables/columns)

Blueprint layers:
1. Personality vectors (assistant identity: name, tone, expertise)
2. JSON structured answers (schema-validated agency data)
3. Raw chat logs (episodic history)

### 1.1 Canonical storage (proposed)

Layer 1 (personality vectors):
- Canonical table: `public.ai_persona_vectors` (NEW)
  - `agency_id uuid not null`
  - `client_id uuid null`
  - `assistant_name text not null default 'Alex'`
  - `tone_traits jsonb not null default '{}'::jsonb`
  - `expertise_traits jsonb not null default '{}'::jsonb`
  - `updated_at timestamptz not null default now()`
  - RLS: agency membership required for all CRUD

Layer 2 (structured answers):
- Canonical table: `public.agency_brains` / `public.client_brains` (EXISTS)
  - `brain_json jsonb not null` (must contain schema-validated final answers and a `version`)
  - Status values already exist (`draft`, `usable`, `complete`, `locked`) - confirm mapping to onboarding completion.
- Optional modular alternative (already present in repo): `public.brain_documents` (EXISTS)
  - Use modules for validated artifacts; enforcement already includes "approved only" consumption in `src/ai/brainResolver.ts`.

Layer 3 (raw chat logs):
- Canonical table: `public.ai_onboarding_turn_logs` (NEW)
  - `agency_id uuid not null`
  - `client_id uuid null`
  - `turn_index int not null`
  - `step_id text not null`
  - `messages_json jsonb not null` (sanitized)
  - `trace_id text`, `span_id text`
  - `created_at timestamptz not null default now()`
  - RLS: agency membership required for all CRUD

Onboarding completion state:
- Canonical table: `public.ai_onboarding_status` (NEW)
  - `agency_id uuid not null`
  - `client_id uuid null`
  - `status text not null` (at least: `in_progress`, `complete`)
  - `completed_at timestamptz null`
  - `updated_at timestamptz not null default now()`
  - Unique: (`agency_id`, `client_id`)
  - RLS: agency membership required for all CRUD

## 2. JSON schema enforcement strategy

Source of truth:
- `src/ai/taskRegistry.ts` defines task-level schemas and safety modes.
- `src/ai/router.ts` enforces schema validation and triggers repair pass.

Strategy:
1. Every onboarding step that expects structured output must run through a task config with `outputMode = json_schema`.
2. If schema validation fails, the router triggers a repair pass using a "return only valid JSON" instruction.
3. If repair fails, the system returns an `UNKNOWN` response with a reason code and next action.

## 3. Repair pass + `UNKNOWN` behavior (router/taskRegistry)

Repair pass:
- Trigger condition: schema validation fails after first model call.
- Behavior: add a repair system message; re-run generation; re-validate.
- Observability: record `repair_attempted` and `repair_success` in spans/runs.

UNKNOWN behavior:
- Trigger condition: missing required tenant context (e.g., missing agency_id) or schema repair failure.
- Behavior: return a structured response that the UI can render and recover from, with `unknown=true` and a reason code.

## 4. Dual-embedding write path and read path

### 4.1 Write path (onboarding completion)

1. Onboarding completes -> finalize structured answers JSON (Layer 2).
2. Build a compact, deterministic summary artifact from the finalized JSON (and selected raw context).
3. Call Edge Function `ai-brain-ingest` with:
   - `agency_id`, optional `client_id`
   - `scope` = `agency` | `client`
   - `raw_responses` or the finalized JSON snapshot
4. `ai-brain-ingest` writes:
   - `ai_documents` (one row per artifact)
   - `ai_document_chunks` (N rows, token-bounded)
   - `ai_embeddings` (vector(1536)) per chunk
   - `ai_embeddings_shadow_gemini_vector` (vector(768)) per chunk when enabled

Dimension invariants:
- `ai_embeddings.embedding` is `vector(1536)`
- `ai_embeddings_shadow_gemini_vector.embedding` is `vector(768)`

### 4.2 Read path (retrieval)

Hard rule: any call to `match_ai_embeddings_scoped` is performed server-side via Edge + `service_role`.

Retrieval flow:
1. Edge receives request with validated `agency_id` (and optional `client_id`).
2. Edge generates/query embedding for user query (or uses shadow embedding path when enabled for experimentation).
3. Edge calls `public.match_ai_embeddings_scoped(p_agency_id, p_query_embedding, p_client_id, ...)`.
4. Edge returns only the scoped chunks and citations to the UI (never raw DB access).

## 5. Cache invalidation + prompt reload mechanism spec

Goal: after onboarding completion, the assistant must immediately adopt the custom persona and updated brain traits.

Mechanism:
1. Completion writes `ai_onboarding_status.status = 'complete'` and sets `completed_at`.
2. Completion updates a monotonic "brain version" key (e.g., `brain_version` or `updated_at`) that is incorporated into prompt cache keys.
3. Any cached prompt/context snapshot is invalidated by:
   - bumping the cache version key, or
   - explicit delete/invalidate call (if cache is centralized)
4. Next AI request:
   - loads persona traits from Layer 1 (default to "Alex")
   - loads structured answers JSON from Layer 2
   - builds a new system prompt and proceeds

Validation:
- A test must prove that the first post-completion message uses the new assistant name/tone/expertise.
