# AI System Audit (SMMAHUB) - 2026-01-31 (Updated 2026-02-01)

This document is a single-source audit of the AI stack in this repo: routing, models, brains, embeddings, RAG, strategy generation, assistants, memory, ingestion, and observability.

This is descriptive only. It summarizes the current implementation and how it is wired.

Security invariant: "0 cross-tenant leaks" (every read/write is tenant scoped by agency_id; client_id scoping is enforced where applicable).

---

## 1) High-Level Architecture

Core layers
- Frontend: calls Supabase Edge Functions.
- Edge Functions (Supabase): `supabase/functions/*` handle auth, tenant checks, context building, RAG, budgets, job dispatch, and call shared modules.
- AI Router (shared): `src/ai/router.ts` selects TaskType config, validates schemas, enforces UNKNOWN rules, and logs usage.
- Provider facade: `src/ai/providers/*` (OpenAI/Gemini/Anthropic) plus a mock provider for deterministic tests.
- Tool executor: `supabase/functions/_shared/tool-executor.ts` runs a bounded allowlisted tool set with tenant checks and (when enabled) governance policies.
- Storage: Postgres tables for brains, documents/chunks/embeddings, memory items, ingestion allowlist, runs/usage logs, and OpenTelemetry spans.

Key safety mechanics
- Membership checks in Edge Functions (agency_members) and RLS in DB tables.
- Embeddings match RPCs are restricted to service_role only (prevents direct client invocation).
- Phase 2 includes cohort gating (PHASE2_COHORT_*) to prevent accidental global enablement.

---

## 2) AI Entry Points (Supabase Edge Functions)

Primary end-user endpoints
- `ai-assistant`: client-level assistant with context_request and optional proposals.
  - `supabase/functions/ai-assistant/index.ts`
- `ai-strategy-generate`: strategy generation with RAG + citations + module persistence.
  - `supabase/functions/ai-strategy-generate/index.ts`
- `ai-ask`: client portal Q&A with RAG + budgets + rate limits.
  - `supabase/functions/ai-ask/index.ts`
- `ai-retrieve-context`: RAG retrieval-only helper (returns matched snippets).
  - `supabase/functions/ai-retrieve-context/index.ts`
- `ai-rep-chat`: lightweight rep chat with safe retrieval and optional episodic capture.
  - `supabase/functions/ai-rep-chat/index.ts`

Ingestion + admin-only endpoints (Phase 2)
- `ai-documents-ingest`: document ingestion, chunking, embeddings, optional contextual summaries.
  - `supabase/functions/ai-documents-ingest/index.ts`
- `ai-ingestion-source-register`: admin-only allowlist registration for ingestion sources (poisoning defense).
  - `supabase/functions/ai-ingestion-source-register/index.ts`
- `ai-memory-approve`: admin-only approval for memory items (long-term memory gate).
  - `supabase/functions/ai-memory-approve/index.ts`

Brain endpoints (v2 modular docs)
- `ai-brain-ingest`, `ai-brain-analyze`, `ai-brain-document-approve`, `ai-brains-agency`, `ai-brains-client`, seeding endpoints, etc.

Background processing
- `ai-job-worker`: processes queued jobs (including memory ingestion).
  - `supabase/functions/ai-job-worker/index.ts`

Guarding
- Endpoint allowlist guard: `supabase/functions/_shared/endpoint-guard.ts`
  - Default: endpoints not allowlisted return 403 (ENDPOINT_DISABLED).
  - Override: `ENABLE_UNUSED_AI_ENDPOINTS=true` disables the guard.

---

## 3) Task Routing, Planner, and Schema Enforcement

Router
- `src/ai/router.ts`
- Responsibilities:
  - TaskType -> prompt builder + schema via `src/ai/taskRegistry.ts`
  - JSON schema validation with a repair pass
  - UNKNOWN fallbacks for strict tasks when required context is missing
  - Usage logging and OpenTelemetry span logging

Task types (selected)
- `src/ai/taskTypes.ts` includes:
  - CLASSIFY_INTENT (intent mode + confidence)
  - PLANNER (plan schema output)
  - TOOL_EXECUTION
  - STRATEGY_PLAN / AI_ASSISTANT
  - EMBED_TEXT

Planner and intent artifacts
- Planner wiring + prompts: `src/ai/planner.ts`, `src/ai/prompts/planner.ts`
- Intent classifier prompt: `src/ai/prompts/classifyIntent.ts`
- Expanded schemas for plans/tool calls/retrieval/memory/strategy: `src/ai/schema.ts`
- Schema registry artifact: `docs/ai/schema_registry.json`

---

## 4) Models, Provider Policy, and RAG Index Switching

Provider policy
- Centralized model policy: `src/ai/modelPolicy.ts`
- Provider implementations: `src/ai/providers/openai.ts`, `src/ai/providers/gemini.ts`, `src/ai/providers/anthropic.ts`
- Mock provider: `src/ai/providers/mock.ts` (tests/compat)

Embeddings + RAG index provider switch (Phase 2)
- `RAG_INDEX_PROVIDER=openai|gemini`
  - openai: uses `ai_embeddings` (vector(1536)) and RPC `match_ai_embeddings*`
  - gemini: uses `ai_embeddings_shadow_gemini_vector` (vector(768)) and RPC `match_ai_embeddings_shadow_gemini*`
- RAG selection helper: `supabase/functions/_shared/rag-index.ts`

---

## 5) Brains and Context Resolution

Brain documents (v2)
- `supabase/functions/_shared/brain-documents.ts`
- Status-based access: brain_document retrieval is approved-only at query time.

Brain resolver (v2)
- `src/ai/brainResolver.ts`
- Returns:
  - ready: context is complete
  - calibration_needed: missing fields + questions to ask

Task -> module mapping
- `src/ai/taskToModuleMap.ts`

---

## 6) Embeddings, Chunking, and Retrieval Safety

Tables (core)
- `ai_documents`, `ai_document_chunks`
- Primary embeddings: `ai_embeddings` (pgvector)
- Shadow Gemini embeddings:
  - `ai_embeddings_shadow_gemini` (jsonb vector payload; shadow write)
  - `ai_embeddings_shadow_gemini_vector` (pgvector(768); Phase 2 cutover readiness)

Chunking behavior (current)
- Documents ingest: 900 tokens, overlap 140, max 120 chunks
  - `supabase/functions/ai-documents-ingest/index.ts`
- Memory ingest: 900 tokens, overlap 140, max 24 chunks
  - `supabase/functions/_shared/memory-ingest.ts`

Retrieval RPCs
- OpenAI index:
  - `match_ai_embeddings` (service_role only)
  - `match_ai_embeddings_scoped` (service_role only; safe inclusion of agency-scoped docs without cross-client leaks)
- Gemini index:
  - `match_ai_embeddings_shadow_gemini` (service_role only)
  - `match_ai_embeddings_shadow_gemini_scoped` (service_role only)

0 cross-tenant leaks notes
- All match functions filter by `d.agency_id = p_agency_id`.
- Scoped variants prevent returning other clients' docs when a specific client_id is provided, while still allowing safe agency-level docs (client_id is null) for a whitelisted set of doc_types.

---

## 7) Contextual Ingestion and Poisoning Defense (Phase 2)

Allowlist table
- `ai_ingestion_sources` (RLS; admin-only writes)
  - Migration: `supabase/migrations/20260202032000_phase2_ingestion_sources.sql`

Enforcement in ingestion
- When `ENABLE_CONTEXTUAL_INGESTION=true` (and Phase 2 is enabled for the tenant), `ai-documents-ingest` enforces:
  - source must be allowlisted for {agency_id, source_type, source_ref}
  - if allowlisted row includes manifest_sha256, request must supply a matching manifest_sha256
  - optional source_url match check

Per-chunk contextual summaries (Phase 2)
- Stored in `ai_document_chunks`:
  - `chunk_summary`, `chunk_summary_tokens`, `chunk_summary_model`, `chunk_summary_status`
- Generated during `ai-documents-ingest` when contextual ingestion is enabled.
  - Migration: `supabase/migrations/20260202035000_phase2_contextual_summaries_and_manifest.sql`

---

## 8) Memory Tiers (Phase 2)

Memory table
- `ai_memory_items` now supports:
  - scope: working|episodic|long_term
  - status: proposed|active|rejected
  - created_by / approved_by / rejected_by timestamps
  - thread_id, checkpoint_id, summary (episodic)

Long-term approval workflow
- Writes may be proposed, then approved via admin-only endpoint:
  - `ai-memory-approve` -> updates status and ingests into `ai_documents` so it is retrievable via embeddings.
  - Doc types: client_memory, agency_memory

Episodic capture
- Buffer: `ai_episodic_buffers` accumulates turns per {agency_id, client_id, thread_id}.
- Capture point: `ai-rep-chat` writes an episodic summary every 5 turns (basic PII heuristics; skips obvious PII).
  - Doc types when ingested: client_episodic, agency_episodic

Note: memory ingestion runs via `ai-job-worker` (cron-triggered) or synchronous ingest on approval (used for staging smoke).

---

## 9) Observability and Metrics (OTel + Usage Logs)

OTel spans
- Table: `ai_otel_spans`
- Written by Edge endpoints using `src/ai/otel.ts`.
- Attributes include http_status and other stage metadata.

Usage logs
- `ai_runs` (task-level structured logging for model calls and outcomes)
- `ai_usage_logs` (endpoint-level counters)

Tenant safety
- ai_otel_spans has RLS and explicit grants (authenticated can read spans for their agency_id only).
- Evidence generation should never store JWTs in repo.

---

## 10) Feature Flags (Operational Switches)

Core (Phase 0/1)
- `AI_OTEL_LOGGING=true|false` (OTel span writes)
- `ENABLE_NEW_RAG_INDEXING=true|false` (shadow Gemini embedding writes)
- `USE_NEW_PLANNER=true|false`
- `USE_DURABLE_EXECUTOR=true|false`
- `ENABLE_RAG_RERANKING=true|false`
- `ENFORCE_TOOL_GOVERNANCE=true|false`
- `ENABLE_UNUSED_AI_ENDPOINTS=true|false` (endpoint guard override)

Phase 2 behavior flags
- `ENABLE_EPISODIC_MEMORY=true|false`
- `ENABLE_LONG_TERM_MEMORY=true|false`
- `ENABLE_CONTEXTUAL_INGESTION=true|false`
- `PHASE2_COHORT_MODE=require_list|allow_all`
- `PHASE2_COHORT_AGENCY_IDS=<csv>`

Phase 2 RAG cutover flags
- `RAG_INDEX_PROVIDER=openai|gemini`
- `GEMINI_EMBED_DIM_EXPECTED=768` (required for gemini pgvector table)

---

## 11) Key Migrations (Selected)

Phase 0/1 foundations (selected)
- `20260118000001_harden_match_ai_embeddings_final.sql`
- `20260201000000_add_ai_shadow_gemini_embeddings.sql`
- `20260201001000_add_ai_otel_spans.sql`
- `20260202020000_grant_ai_otel_spans_authenticated.sql`

Phase 2 (selected)
- `20260202031000_phase2_memory_items.sql`
- `20260202032000_phase2_ingestion_sources.sql`
- `20260202033000_phase2_allow_memory_doc_types.sql`
- `20260202034000_phase2_episodic_memory.sql`
- `20260202035000_phase2_contextual_summaries_and_manifest.sql`
- `20260202036000_phase2_gemini_shadow_vector_rag.sql`
- `20260202037000_harden_phase2_rag_functions.sql`

---

## 12) Evidence and Operational Runners (No JWTs in Repo)

Staging smoke
- Phase 2 smoke (ingestion allowlist + manifest + summaries + memory approval ingest + retrieval):
  - `scripts/smoke/phase2_staging_smoke.mjs`
  - Evidence examples:
    - `tests/integration/cutover/results/2026-02-01_phase2_staging_smoke_v2.json`
    - `tests/integration/cutover/results/2026-02-01_phase2_rag_index_cutover_smoke.json`

Daily checklist runner (produces today's artifacts)
- `scripts/phase2/day_check.mjs`
  - Perf: `tests/perf/results/YYYY-MM-DD_ai-retrieve-context_p95.json`
  - Evals: `tests/evals/results/YYYY-MM-DD_eval_harness.json`
  - Tenant spot check: `tests/security/results/YYYY-MM-DD_tenant_spotcheck.json`
  - OTel spot check: `tests/perf/results/YYYY-MM-DD_otel_spotcheck.json`

Full tenant audit runner (requires 2 real tenants + 2 JWTs; does not store tokens)
- `scripts/security/full_tenant_audit_runner.mjs`
  - Output: `tests/security/results/YYYY-MM-DD_full_tenant_audit.json`

---

## 13) Known Unknowns / Follow-ups

UNKNOWN / time-gated (cannot be manufactured)
- 7 consecutive days of production validation evidence (Phase 2 DoD).
- Human evaluation protocol execution and scored results.

TODO
- Keep this audit updated when adding new agent endpoints/tools so tenant scoping ("0 cross-tenant leaks") remains explicit.

