# AI System Audit (SMMAHUB) — 2026-01-31

This document is a single-source audit of the AI stack in this repo: routing, models, brains, embeddings, RAG, strategy generation, and AI assistants. It is descriptive only (no code changes).

---

## 1) High-Level Architecture

**Core layers**
- **Frontend AI hooks**: client UI calls Supabase Edge Functions (e.g., `useAiAssistant`).
- **Edge Functions** (Supabase): `supabase/functions/*` handle auth, context building, RAG, budgets, and invoke the shared AI router.
- **AI Router (shared)**: `src/ai/router.ts` selects task config, loads/validates brain context, runs providers, validates schemas, logs usage.
- **Providers**: `src/ai/providers/*` implement OpenAI, Gemini, Anthropic with retries/timeouts/circuit breaker.
- **Brain + RAG storage**: Postgres tables + RPC for embeddings + brain documents.

---

## 2) AI Entry Points (Supabase Edge Functions)

**Key endpoints**
- `ai-assistant` — client-level assistant (chat + optional strategy proposals).
  - File: `supabase/functions/ai-assistant/index.ts`
- `ai-strategy-generate` — full strategy generation.
  - File: `supabase/functions/ai-strategy-generate/index.ts`
- `ai-ask` — client portal Q&A (RAG, budgets, rate limits).
  - File: `supabase/functions/ai-ask/index.ts`
- `ai-retrieve-context` — direct embeddings retrieval for a query.
  - File: `supabase/functions/ai-retrieve-context/index.ts`
- `ai-documents-ingest` — ingest documents to embeddings.
  - File: `supabase/functions/ai-documents-ingest/index.ts`
- `ai-brain-ingest` — ingest brain documents to embeddings.
  - File: `supabase/functions/ai-brain-ingest/index.ts`
- `ai-job-worker` — background jobs (summaries + embeddings).
  - File: `supabase/functions/ai-job-worker/index.ts`
- `ai-rep-chat`, `ai-onboarding-guide`, `generate-ai-content`, `generate-monthly-report`, etc.

**Guarding**
- All public AI endpoints are gated by `endpoint-guard` allowlist.
  - File: `supabase/functions/_shared/endpoint-guard.ts`

---

## 3) Task Routing & Schema Enforcement

**Router**
- Source: `src/ai/router.ts`
- Responsibilities:
  - Maps `TaskType` → prompt builder + schema (via `taskRegistry.ts`)
  - Loads brain context (v2 resolver)
  - Enforces strict-unknown behavior
  - Validates JSON schema with auto-repair attempt
  - Logs usage + metadata

**Task registry**
- Source: `src/ai/taskRegistry.ts`
- Defines:
  - `TaskType` config, output mode (freeform / json_schema / embedding)
  - Required brain modules
  - `buildUnknown` fallbacks

**Schema validation**
- Source: `src/ai/schema.ts`
- Includes `AiAssistantSchema`, `AdminChatSchema`, etc.
- Repair flow: a second attempt with “return only valid JSON” instructions.

---

## 4) Model Selection & Provider Policy

**Model policy**
- Source: `src/ai/modelPolicy.ts`
- Defaults:
  - General text: `gpt-4o-mini` (OpenAI)
  - Strategy & AI Assistant: `gemini-flash-latest` (Gemini)
  - Embeddings: `text-embedding-3-small` (OpenAI)
- Overrides:
  - `AI_PROVIDER__{TASK}` / `AI_MODEL__{TASK}` (per-task)
  - Strategy tasks are pinned to Gemini unless per-task override is used.

**Providers**
- OpenAI: `src/ai/providers/openai.ts`
- Gemini: `src/ai/providers/gemini.ts`
- Features:
  - Retries + timeouts + circuit breaker (controlled by env flags)
  - Gemini JSON generation uses `response_mime_type=application/json`

---

## 5) Brain Documents & Context Resolution

**Brain documents**
- Schema & helpers: `supabase/functions/_shared/brain-documents.ts`
- Tables:
  - `brain_documents`
  - `brain_document_versions`
  - `brain_calibration_state` (calibration tracking)
- Statuses: `draft`, `pending_approval`, `approved`, `archived`
- Approved-only rule: runtime uses approved docs only

**Brain resolver**
- Source: `src/ai/brainResolver.ts`
- Pulls approved brain docs, validates required fields per task, and returns:
  - `ready` (complete context)
  - `calibration_needed` (missing fields + questions)

**Task → Brain module requirements**
- Source: `src/ai/taskToModuleMap.ts`
- Example:
  - `AI_ASSISTANT` requires `rep_policy` + `quality_bar` (style + quality)
  - `STRATEGY_PLAN` requires `bootstrap`, `tone_voice`, `sop_strategy` etc.

---

## 6) Embeddings & Vector Search

**Storage**
- Tables:
  - `ai_document_chunks` (chunk metadata)
  - `ai_embeddings` (vector table)
- RPC:
  - `match_ai_embeddings` (service role only)
    - Hardened in migrations (see `20260118000001_harden_match_ai_embeddings_final.sql`)

**Chunking**
- `ai-documents-ingest`: 900 tokens / 140 overlap / max 120 chunks
  - File: `supabase/functions/ai-documents-ingest/index.ts`
- `ai-brain-ingest`: 900 tokens / 140 overlap / max 12 chunks
  - File: `supabase/functions/ai-brain-ingest/index.ts`
- `ai-job-worker` summary chunks: 900 / 140 / max 12
  - File: `supabase/functions/ai-job-worker/index.ts`

**Embeddings model**
- Default: `text-embedding-3-small` (OpenAI)
- Env override: `EMBEDDING_MODEL_ID`
- Expected dimensionality: `AI_EMBED_DIM_EXPECTED` (default 1536)
  - File: `supabase/functions/_shared/embeddings.ts`

**Embedding policy**
- File: `supabase/functions/_shared/embedding-policy.ts`
- Handles missing API keys and embedding failures gracefully (or hard-fail if configured)

---

## 7) RAG (Retrieval-Augmented Generation)

**RAG policy**
- Source: `src/ai/ragPolicy.ts`
- Per-task configuration (doc types, top-k, similarity, token cap)
- Controlled via `AI_RAG_CENTRALIZED` flag (boolean or % rollout)

**RAG selection & truncation**
- Uses `capMatchesByTokenBudget` and token limits
  - File: `supabase/functions/_shared/retrieval.ts`

**RAG usage**
- `ai-ask`: always retrieves embeddings (unless disabled), plus budgets/rate limits
- `ai-strategy-generate`: retrieves client + agency + exemplar embeddings, with fallback to approved docs if empty
- `ai-assistant`: can request embeddings via `context_request` tool

---

## 8) Strategy Generation Flow

**Endpoint**
- `supabase/functions/ai-strategy-generate/index.ts`

**Core steps**
1. Validate membership + request
2. Load client data, onboarding answers, and brain readiness
3. RAG retrieval (client/agency/exemplar embeddings)
4. Call router task `STRATEGY_PLAN`
5. Validate output against `strategyOutputSchema` (Zod)
6. Evaluate quality per module (rules engine)
7. Persist strategy modules + strategy document + citations

**Output schema**
- File: `supabase/functions/_shared/strategy-output.ts`

**Quality checks**
- `src/lib/strategy/rulesEngine.ts`

---

## 9) AI Assistant (Client Detail) Flow

**Endpoint**
- `supabase/functions/ai-assistant/index.ts`

**Startup context**
- Requires approved `rep_policy` and `quality_bar`
- Includes:
  - user name + role
  - client basics
  - conversation summary (auto-summarized after enough messages)

**On-demand context**
The assistant can request more info via `context_request.requests`:
- `brain_module`
- `strategy_modules`
- `strategy_document`
- `client_basics`
- `embeddings_search`

**Chat persistence**
- Tables:
  - `client_ai_chat_threads`
  - `client_ai_chat_messages`
- RLS: users only see their own chat threads/messages
  - Migration: `supabase/migrations/20260131120000_client_ai_assistant_chat.sql`

**Strategy changes**
- Assistant can propose module updates but never applies directly
- UI enforces confirm + undo (history-based)

---

## 10) Client Portal Q&A (ai-ask)

**Endpoint**
- `supabase/functions/ai-ask/index.ts`

**Controls**
- Daily rate limit (`ai_rate_limits`)
- Monthly budget guard (`ai_budgets`)
- Logging via `ai_runs`

**RAG**
- Embeddings-based context; prompts use prompt registry (`ai_prompt_registry`)

---

## 11) AI Usage & Observability

**Usage logging**
- `ai_runs` table written by `runAiTask` or endpoint-specific handlers
  - File: `supabase/functions/_shared/ai.ts`

**Budgets**
- `ai_budgets` + `ai_rate_limits` enforced by `runAiTask` and `ai-ask`

---

## 12) Key Data Structures (DB)

**Core AI tables**
- `brain_documents`, `brain_document_versions`, `brain_calibration_state`
- `ai_document_chunks`, `ai_embeddings`
- `ai_runs`, `ai_rate_limits`, `ai_budgets`, `ai_escalations`
- `client_ai_chat_threads`, `client_ai_chat_messages`

**Key RPC**
- `match_ai_embeddings` (service role only)
- `get_approved_brain_documents` (by agency)

---

## 13) Environment Flags & Config

**Model & provider**
- `AI_MODE` (dev/prod)
- `AI_PROVIDER`, `AI_MODEL` (global)
- `AI_PROVIDER__{TASK}`, `AI_MODEL__{TASK}` (per-task)

**Provider resilience**
- `AI_PROVIDER_TIMEOUTS`
- `AI_PROVIDER_RETRIES`
- `AI_CIRCUIT_BREAKER`

**Embeddings**
- `EMBEDDING_MODEL_ID`
- `AI_EMBED_DIM_EXPECTED`

**RAG**
- `AI_RAG_CENTRALIZED` (true/false or percent rollout)

---

## 14) Notable Constraints & Safety

- Strategy/assistant tasks are pinned to Gemini by default.
- Schema enforcement uses “strict_unknown” for high-safety tasks.
- Embedding search RPC is locked to service role.
- AI Assistant won’t run without Communication Style + Quality Standard approved.

---

## 15) Quick File Index (for future audits)

**Core routing**
- `src/ai/router.ts`
- `src/ai/taskRegistry.ts`
- `src/ai/modelPolicy.ts`
- `src/ai/schema.ts`

**RAG + brains**
- `src/ai/brainResolver.ts`
- `src/ai/taskToModuleMap.ts`
- `src/ai/ragPolicy.ts`
- `supabase/functions/_shared/brain-documents.ts`
- `supabase/functions/_shared/embeddings.ts`

**Edge functions**
- `supabase/functions/ai-assistant/index.ts`
- `supabase/functions/ai-strategy-generate/index.ts`
- `supabase/functions/ai-ask/index.ts`
- `supabase/functions/ai-retrieve-context/index.ts`
- `supabase/functions/ai-documents-ingest/index.ts`
- `supabase/functions/ai-brain-ingest/index.ts`
- `supabase/functions/ai-job-worker/index.ts`

