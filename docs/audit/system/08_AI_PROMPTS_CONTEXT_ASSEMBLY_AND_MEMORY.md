# 08 — AI Prompts, Context Assembly, and “Memory” (Current Truth)

## Glossary (shared terms)
- **Prompt registry (filesystem)**: prompt markdown files under `/prompts/*` read by `loadPromptText(...)` (evidence: `src/ai/promptRegistry.ts:69`).
- **Task**: a named `TaskType` routed through `src/ai/router.ts` and configured by `src/ai/taskRegistry.ts` (evidence: `src/ai/router.ts:3`).
- **Memory (vector)**: `ai_documents` → `ai_document_chunks` → `ai_embeddings`, retrieved via `match_ai_embeddings` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:34`, `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:11`).
- **Memory (structured JSON)**: `agency_brains.brain_json` and `client_brains.brain_json` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:7`).
- **Usage logging**: `ai_usage_logs` (and `ai_runs`) writes that record endpoint/model/tokens and success (evidence: `supabase/functions/_shared/ai.ts:168`, `supabase/functions/ai-strategy-generate/index.ts:609`).

## Purpose
Document where prompts live, how messages are constructed, which data is used as “memory” (vector + structured), what providers/models are used (router-level), and what guardrails exist (rate limits, budgets, logging, schema validation).

---

## Data model (tables + key columns + RLS status)
This module is about AI execution and memory, so the main “source of truth” tables are:
- `ai_documents` / `ai_document_chunks` / `ai_embeddings` for vector memory (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:34`, `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:61`, `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:71`).
- `ai_usage_logs` for usage logging (evidence: `supabase/migrations/20251224090000_brain_spine_v1.sql:16`).
- `ai_runs` for per-run logs including costs and citations (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:97`).
- `ai_rate_limits` and `ai_budgets` for guardrails (exist in schema and used by shared AI guard code) (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:131`, `supabase/functions/_shared/ai.ts:71`).

---

## UI entry points (where “AI” is invoked from the app)
This audit focuses on the underlying mechanics, but concrete UI triggers include:
- Agency Admin chat: `/ai/admin` (admin only) → `ai-agency-admin-chat` (evidence: `src/App.tsx:273`, `src/pages/ai/AgencyAiAdmin.tsx:627`).
- Strategy generation: `useGenerateStrategyDocument` and `useGenerateStrategy` → `ai-strategy-generate` (evidence: `src/hooks/useStrategyDocuments.ts:67`, `src/hooks/useStrategyModules.ts:268`).
- Content generation: `generate-ai-content` invoked from pipeline components (evidence: `src/components/pipeline/AIGenerateModal.tsx:100`).

---

## Prompt locations (what exists today)
### Prompt markdown files
- Prompts live under the repo root `prompts/` directory and are loaded at runtime via `loadPromptText(relativePath)` (evidence: `src/ai/promptRegistry.ts:73`, `src/ai/promptRegistry.ts:78`).

### Admin chat prompt assembly (strategic mode)
- `buildAdminGeneralChatPrompt(...)` loads:
  - `admin_chat/system_v1.md`
  - `admin_chat/developer_v1.md`
  - `admin_chat/output_contracts_v1.md`
  - and a selected playbook file (core_offer/strategy/copywriting)
  - (evidence: `src/ai/prompts/adminGeneralChat.ts:17`, `src/ai/prompts/adminGeneralChat.ts:21`).
- In strategic mode, it sends:
  - `system` message with registry + contracts + playbook
  - `developer` message (developer registry)
  - `user` message containing `context_blob`, `playbook`, and the latest user message (evidence: `src/ai/prompts/adminGeneralChat.ts:46`).

### Admin chat prompt assembly (legacy + schema modes)
- “Legacy” and “schema” modes use hardcoded system prompts in code (not markdown files) (evidence: `src/ai/prompts/adminGeneralChat.ts:52`).
- The user prompt includes:
  - “AGENCY CONTEXT (from embeddings - most relevant)” + `ragContext`
  - “FULL BRAIN (structured)” + `contextSnapshot`
  - “Conversation so far” + `conversation`
  - (evidence: `src/ai/prompts/adminGeneralChat.ts:108`).

---

## Context assembly (what gets passed into models)
### Router-level structure (`src/ai/router.ts`)
- Requests are made via `ai.run({ taskType, input/messages, context, metadata, outputSchema })` (evidence: `src/ai/router.ts:195`).
- The router can run in:
  - “legacy monolithic brain_json” mode (fetch agency/client brain contexts) (evidence: `src/ai/router.ts:258`).
  - optional “brain resolver” mode (`useBrainResolver`) that resolves modular documents into a flattened context (evidence: `src/ai/router.ts:233`).
  - **UNKNOWN whether `useBrainResolver` is enabled in production for any endpoint in this repo**.
    - How to verify: search for `createAiRouter({ useBrainResolver:` usage.

### Strategy generation context (`ai-strategy-generate`)
Strategy generation does its own context assembly (not only via router):
- `promptContext` concatenates:
  - onboarding profile JSON
  - structured strategy module JSON
  - RAG context from `match_ai_embeddings`
  - references section
  - (evidence: `supabase/functions/ai-strategy-generate/index.ts:383`).
- Then calls `ai.run({ taskType: STRATEGY_PLAN, metadata: { context: promptContext, instruction } })` (evidence: `supabase/functions/ai-strategy-generate/index.ts:394`).

### Admin chat context (`ai-agency-admin-chat`)
- `runAdminGeneralChatAi(...)`:
  - optionally fetches RAG snippets via `match_ai_embeddings` (agency-level, client_id null) (evidence: `supabase/functions/_shared/agency-admin-general-ai.ts:501`).
  - builds `contextBlob` with snapshot, brain state, and memory snippets (evidence: `supabase/functions/_shared/agency-admin-general-ai.ts:585`).
  - calls `runAiTask(...)` with metadata including contextSnapshot, conversation, ragContext, contextBlob, playbook (evidence: `supabase/functions/_shared/agency-admin-general-ai.ts:596`).

---

## Memory systems (what “memory” exists today)
### 1) Vector memory (RAG)
**Storage**
- `ai_documents` stores source content and metadata (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:34`).
- `ai_document_chunks` stores chunk text; retrieval filters by `embedding_status='ok'` (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:46`).
- `ai_embeddings` stores `vector(1536)` embeddings (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:78`).

**Retrieval**
- Primary retrieval surface is `public.match_ai_embeddings(...)` (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:11`).
- Used by:
  - `ai-strategy-generate` (evidence: `supabase/functions/ai-strategy-generate/index.ts:274`).
  - admin chat (optional) via `fetchAgencyRagSnippets` (evidence: `supabase/functions/_shared/agency-admin-general-ai.ts:501`).
  - `ai-retrieve-context` endpoint (evidence: `supabase/functions/ai-retrieve-context/index.ts:129`).

### 2) Structured memory (DB rows / JSON)
- `agency_brains.brain_json` (agency-wide context, patched by onboarding/admin setup) (evidence: `supabase/functions/_shared/agency-admin-chat.ts:167`, `supabase/functions/ai-brain-ingest/index.ts:211`).
- `client_brains.brain_json` (client context, gate for strategy) (evidence: `supabase/functions/ai-strategy-generate/index.ts:170`).
- Strategy structured state: `strategies` + `strategy_modules` (evidence: `supabase/functions/ai-strategy-generate/index.ts:216`, `supabase/migrations/20251229100000_strategy_os.sql:33`).

### 3) “Memory items” table
- `ai_memory_items` stores summaries like `client_brain_summary` (evidence: `supabase/migrations/20251224090000_brain_spine_v1.sql:6`, `supabase/functions/ai-brain-ingest/index.ts:322`).

---

## Providers and models (router-level)
### Router selects provider/model per task
- Router imports `providers` and uses `resolveTaskModel(...)` and task config (evidence: `src/ai/router.ts:3`, `src/ai/router.ts:6`).
- **Model override for embeddings**:
  - `embedText` uses `ai.run` with `TaskType.EMBED_TEXT` and includes metadata `{ modelOverride, outputDimensionality }` (evidence: `supabase/functions/_shared/embeddings.ts:46`, `supabase/functions/_shared/embeddings.ts:51`).

### Strategy model selection (explicit fallback)
- Strategy generation uses `STRATEGY_MODEL_ID` env fallback `gpt-4o-mini` for runtime model logging if schema invalid or other paths (evidence: `supabase/functions/ai-strategy-generate/index.ts:414`).

---

## Guardrails (rate limit, budget, schema validation, logging)
### Rate limiting and budgets (shared `runAiTask`)
- `runAiTask` enforces daily rate limit (`ai_rate_limits`) and monthly budget (`ai_budgets`) when `supabase`, `agencyId`, and `userId` are present (evidence: `supabase/functions/_shared/ai.ts:219`).
- Default limits:
  - daily limit 20 (evidence: `supabase/functions/_shared/ai.ts:42`).
  - monthly budget $50 (evidence: `supabase/functions/_shared/ai.ts:43`).
- It writes/updates:
  - `ai_rate_limits.used_count` per (agency,user,day) (evidence: `supabase/functions/_shared/ai.ts:78`, `supabase/functions/_shared/ai.ts:106`).
  - `ai_budgets.spent_usd` via budget helpers (evidence: `supabase/functions/_shared/ai.ts:7`).
- **Coverage is UNKNOWN across endpoints**:
  - Some endpoints call `runAiTask` (admin chat) (evidence: `supabase/functions/_shared/agency-admin-general-ai.ts:596`).
  - Others call `ai.run` directly (strategy generation) and implement their own logging (evidence: `supabase/functions/ai-strategy-generate/index.ts:394`).

### Schema validation and repair (router-level)
- Router attempts schema extraction/validation, then adds a repair system message and retries once if invalid (evidence: `src/ai/router.ts:144`, `src/ai/router.ts:152`).

### Usage and run logging
- `runAiTask` logs:
  - usage via `logUsage` (which writes to `ai_usage_logs`) (evidence: `supabase/functions/_shared/ai.ts:168`).
  - run records to `ai_runs` (evidence: `supabase/functions/_shared/ai.ts:183`).
- `ai-strategy-generate` writes to `ai_runs` and `ai_usage_logs` itself (evidence: `supabase/functions/ai-strategy-generate/index.ts:583`, `supabase/functions/ai-strategy-generate/index.ts:609`).

---

## AI behavior summary — YES/NO/UNKNOWN
- **Prompts stored on disk and loaded at runtime**: YES (evidence: `src/ai/promptRegistry.ts:78`).
- **Admin chat uses RAG snippets**: YES (optional, requires OPENAI_API_KEY) (evidence: `supabase/functions/_shared/agency-admin-general-ai.ts:489`, `supabase/functions/_shared/agency-admin-general-ai.ts:495`).
- **Strategy generation uses RAG**: YES (evidence: `supabase/functions/ai-strategy-generate/index.ts:386`).
- **Centralized RAG policy rollout**: UNKNOWN (depends on `AI_RAG_CENTRALIZED` env) (evidence: `src/ai/ragPolicy.ts:144`).

---

## “Source of truth” (what determines what the AI “knows”)
- Prompt content truth:
  - strategic admin chat: files under `prompts/admin_chat/*` (evidence: `src/ai/prompts/adminGeneralChat.ts:17`).
  - legacy admin chat: hardcoded system instructions (evidence: `src/ai/prompts/adminGeneralChat.ts:95`).
- Memory truth:
  - vector memory is whatever is in `ai_embeddings` and eligible via `match_ai_embeddings` filters (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:46`).
  - structured memory is whatever is in `agency_brains.brain_json` / `client_brains.brain_json` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:13`).

---

## Cross-tenant risks and isolation enforcement
- Admin chat RAG retrieval calls `match_ai_embeddings(p_agency_id=...)`; isolation depends on correct privilege hardening and correct agencyId usage (evidence: `supabase/functions/_shared/agency-admin-general-ai.ts:501`).
- `match_ai_embeddings` privilege drift after signature changes is a potential cross-tenant risk (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:11`).

---

## Explicit answers required by the mission
### Q9) Does Agency AI Setup impact client strategy generation? Where exactly?
- **YES**: strategy generation retrieves `brain_document` chunks and includes them in prompt context (evidence: `supabase/functions/ai-strategy-generate/index.ts:271`, `supabase/functions/ai-strategy-generate/index.ts:386`).

### Q10) Are Agency Brain docs embedded and used as RAG? Which tables store chunks/embeddings?
- **YES** (for modular docs once ingested as `brain_document`):
  - `ai_documents`, `ai_document_chunks`, `ai_embeddings` (evidence: `supabase/migrations/20260108123000_brain_documents_rag.sql:16`, `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:71`).

### Q11) What is the end goal, and where does current code diverge?
- End goal implied by prompts: “AI representative inside SMMAHUB” with structured outputs and optional actions (evidence: `src/ai/prompts/adminGeneralChat.ts:54`).
- Divergence: not all endpoints use the same guardrails/logging path (`runAiTask` vs direct `ai.run`); some logging is duplicated and some rate-limit/budget enforcement may not apply universally (evidence: `supabase/functions/_shared/agency-admin-general-ai.ts:596`, `supabase/functions/ai-strategy-generate/index.ts:394`).

---

## Failure modes (top 5) + how they surface
1) **Prompt file missing/empty** → `loadPromptText` throws (production and non-prod both throw) (evidence: `src/ai/promptRegistry.ts:86`).
2) **OPENAI_API_KEY missing** → admin chat RAG returns empty snippets; strategy generation returns 500 with `code=MISSING_API_KEY` (evidence: `supabase/functions/_shared/agency-admin-general-ai.ts:495`, `supabase/functions/ai-strategy-generate/index.ts:231`).
3) **Schema repair fails** → router returns UNKNOWN output (evidence: `src/ai/router.ts:168`).
4) **AI rate limit hit** → `runAiTask` returns blocked result with `AI_RATE_LIMIT` (evidence: `supabase/functions/_shared/ai.ts:99`).
5) **Monthly budget exceeded** → blocked result with `AI_BUDGET_EXCEEDED` (evidence: `supabase/functions/_shared/ai.ts:137`).

---

## Verification checklist (commands + SQL)
### Repo commands (required by request)
- `npm test`
- `npm run lint`
- `npx tsc -p tsconfig.json --noEmit`
- `npm run build`

### Prompt verification (local)
```sh
# Confirm prompt files exist and are readable
ls prompts/admin_chat
```

### SQL checks (memory + guardrails)
```sql
-- Last 10 AI runs
select created_at, model, tokens_in, tokens_out, cost_usd, success, unknown, metadata
from public.ai_runs
order by created_at desc
limit 10;
```

```sql
-- Last 10 usage logs
select created_at, endpoint, model, tokens_in, tokens_out, latency_ms, unknown, metadata
from public.ai_usage_logs
order by created_at desc
limit 10;
```

```sql
-- Rate limits for a user/day
select *
from public.ai_rate_limits
where agency_id = :agency_id and user_id = :user_id
order by day_yyyy_mm_dd desc
limit 10;
```

---

## Prompt inventory (where prompts live today)
This repo mixes “prompt files on disk” and inline prompt strings.

### Disk-backed prompt registry (admin chat)
- Admin chat loads multiple files from `prompts/admin_chat/*` using `loadPromptText(...)` (evidence: `src/ai/prompts/adminGeneralChat.ts:17`).
- `loadPromptText` reads from disk and throws if the file is missing/unreadable (evidence: `src/ai/promptRegistry.ts:78`, `src/ai/promptRegistry.ts:86`).

### Verification commands (prompt files)
```sh
ls prompts/admin_chat
rg -n "admin_chat/" src/ai/prompts/adminGeneralChat.ts
```

---

## Retrieval inventory (where vector retrieval is invoked)
Call sites that invoke `match_ai_embeddings` to assemble context:
- Strategy generation (client/agency/exemplar) (evidence: `supabase/functions/ai-strategy-generate/index.ts:274`).
- Ask endpoint (client/agency/exemplar) (evidence: `supabase/functions/ai-ask/index.ts:353`).
- Admin general AI retrieval (agency scoped) (evidence: `supabase/functions/_shared/agency-admin-general-ai.ts:501`).

### Verification command (retrieval call sites)
```sh
rg -n "rpc\\(\\\"match_ai_embeddings\\\"\\)" supabase/functions -S
```
