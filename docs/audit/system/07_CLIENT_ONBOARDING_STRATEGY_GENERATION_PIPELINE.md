# 07 — Client Onboarding → Strategy Generation Pipeline (Current Truth)

## Glossary (shared terms)
- **Client onboarding route**: `/onboarding/client/:clientId` (and legacy aliases) → `AiOnboardingClientV4` (evidence: `src/App.tsx:276`, `src/pages/ai/AiOnboardingClientV4.tsx:14`).
- **Client onboarding profile (V4 table)**: `client_onboarding_profiles` (18-question wizard schema) (evidence: `supabase/migrations/20251230200000_client_onboarding_v4.sql:16`).
- **Client Brain (JSON)**: `client_brains.brain_json` and `client_brains.usable` gate strategy generation (evidence: `supabase/functions/ai-strategy-generate/index.ts:170`).
- **Client brain ingest**: `ai-brain-ingest scope='client'` maps raw answers → client brain JSON + writes summary memory artifacts (evidence: `supabase/functions/ai-brain-ingest/index.ts:310`).
- **Strategy generation**: `ai-strategy-generate` edge function (retrieval + AI run + create_strategy_snapshot) (evidence: `src/hooks/useStrategyDocuments.ts:67`, `supabase/functions/ai-strategy-generate/index.ts:510`).
- **Strategy snapshot**: DB RPC `create_strategy_snapshot(...)` writes `strategy_documents` and `strategy_modules` atomically (evidence: `supabase/migrations/20260108143000_strategy_snapshot_rpc.sql:3`).

## Purpose
Document the end-to-end client onboarding and strategy generation pipeline as implemented today: how client data is captured, what tables are written, how “usable” is determined, how strategy generation is triggered, what context sources it uses (client brain, agency brain, RAG docs), and how “References” are produced.

---

## Data model (tables + key columns + RLS status)
### Client onboarding profiles (V4)
- Table: `public.client_onboarding_profiles` (evidence: `supabase/migrations/20251230200000_client_onboarding_v4.sql:16`).
- Key columns used by strategy generation:
  - `client_id`, `agency_id` (evidence: `supabase/migrations/20251230200000_client_onboarding_v4.sql:18`).
  - `ai_scan_result`, `ai_scan_at`, `ai_scan_accepted` exist in later upsert RPC migration (evidence: `supabase/migrations/20251230200010_fix_onboarding_rpc_array_handling.sql:192`).
- RLS: enabled + member-based policies (evidence: `supabase/migrations/20251230200000_client_onboarding_v4.sql:151`, `supabase/migrations/20251230200000_client_onboarding_v4.sql:156`).

### Client brains
- Table: `public.client_brains` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:20`).
- Key columns:
  - `brain_json`, `status`, `usable` (evidence: `supabase/migrations/20251224090000_brain_spine_v1.sql:3`).

### Strategy OS tables (write targets of ai-strategy-generate)
- `public.strategies` (container/versioning) (evidence: `supabase/migrations/20251230090000_strategy_os_ops.sql:4`).
- `public.strategy_modules` (6 module rows per strategy) (evidence: `supabase/migrations/20251229100000_strategy_os.sql:33`).
- `public.strategy_documents` (document markdown/html; active flag) (evidence: `supabase/migrations/20260106120000_strategy_documents.sql:3`).
- RPC: `public.create_strategy_snapshot(...)` (service-role execute in migrations) (evidence: `supabase/migrations/20260108143000_strategy_snapshot_rpc.sql:182`).

### RAG context inputs used by ai-strategy-generate
- `ai_documents` / `ai_document_chunks` / `ai_embeddings` via `match_ai_embeddings` (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:42`).

---

## UI entry points (routes + components)
### Onboarding routes
- `/onboarding/client/:clientId` → `AiOnboardingClient` (same component used for multiple legacy routes) (evidence: `src/App.tsx:276`, `src/App.tsx:279`).
- The route component `AiOnboardingClientV4` fetches the client row and then renders either:
  - `OnboardingV5Wizard` when feature flag `ONBOARDING_V5` is enabled (evidence: `src/pages/ai/AiOnboardingClientV4.tsx:17`, `src/pages/ai/AiOnboardingClientV4.tsx:91`),
  - or `OnboardingWizard` (V4 UI) otherwise (evidence: `src/pages/ai/AiOnboardingClientV4.tsx:93`).

### Strategy generation triggers in UI
There are at least two separate “generate” pathways in the frontend:
- `useGenerateStrategyDocument()` calls `ai-strategy-generate` and expects `{document: StrategyDocumentRecord | null}` (evidence: `src/hooks/useStrategyDocuments.ts:67`).
- `useGenerateStrategy()` calls `ai-strategy-generate` and implements template fallback behavior on error/unknown (evidence: `src/hooks/useStrategyModules.ts:252`, `src/hooks/useStrategyModules.ts:268`).

---

## Backend/API entry points (edge functions + RPCs)
### Client onboarding (V5 UI → brain tables)
`OnboardingV5Wizard` performs:
- Create client brain: `ai-brains-client action=create` (evidence: `src/components/onboarding-v5/OnboardingV5Wizard.tsx:597`).
- Update client brain: `ai-brains-client action=update` (evidence: `src/components/onboarding-v5/OnboardingV5Wizard.tsx:610`).
- Ingest client brain: `ai-brain-ingest scope='client'` with `raw_responses` and `followup_responses` (evidence: `src/components/onboarding-v5/OnboardingV5Wizard.tsx:621`).

### Strategy generation (edge)
`ai-strategy-generate`:
- Loads `clients.agency_id`, validates membership or cron secret, loads latest `client_brains`, gates usability, retrieves RAG matches, runs AI task, writes `strategy_documents`+`strategy_modules` via `create_strategy_snapshot` (evidence: `supabase/functions/ai-strategy-generate/index.ts:118`, `supabase/functions/ai-strategy-generate/index.ts:185`, `supabase/functions/ai-strategy-generate/index.ts:274`, `supabase/functions/ai-strategy-generate/index.ts:395`, `supabase/functions/ai-strategy-generate/index.ts:510`).

---

## Control flow diagram (client onboarding → strategy) in text
### Flow A: Client onboarding (V5) → client brain ingest
Step 1 → User visits `/onboarding/client/:clientId` (evidence: `src/App.tsx:276`).
Step 2 → `AiOnboardingClientV4` loads client record and chooses V5 wizard if flag enabled (evidence: `src/pages/ai/AiOnboardingClientV4.tsx:20`, `src/pages/ai/AiOnboardingClientV4.tsx:91`).
Step 3 → V5 wizard builds a `rawResponses` object from form fields (evidence: `src/components/onboarding-v5/OnboardingV5Wizard.tsx:583`).
Step 4 → V5 wizard creates/updates `client_brains` via `ai-brains-client` (evidence: `src/components/onboarding-v5/OnboardingV5Wizard.tsx:597`, `src/components/onboarding-v5/OnboardingV5Wizard.tsx:610`).
Step 5 → V5 wizard calls `ai-brain-ingest scope='client'` to map+persist usable brain and embed a summary artifact (evidence: `src/components/onboarding-v5/OnboardingV5Wizard.tsx:621`, `supabase/functions/ai-brain-ingest/index.ts:310`, `supabase/functions/ai-brain-ingest/index.ts:333`).
Step 6 → V5 wizard calls `ai-strategy-generate` with `client_id` and then shows toast “Your strategy is ready. Redirecting to client detail.” before navigating to `/clients/:clientId` (evidence: `src/components/onboarding-v5/OnboardingV5Wizard.tsx:634`, `src/components/onboarding-v5/OnboardingV5Wizard.tsx:647`).

### Flow B: Strategy generation (UI) → ai-strategy-generate → DB snapshot
Step 1 → User triggers a generate action in Strategy UI; hook calls `ai-strategy-generate` with `client_id` (evidence: `src/hooks/useStrategyDocuments.ts:67`).
Step 2 → Server resolves `agency_id` via `clients` and checks membership (evidence: `supabase/functions/ai-strategy-generate/index.ts:118`, `supabase/functions/ai-strategy-generate/index.ts:157`).
Step 3 → Server loads latest `client_brains` row and evaluates `usable` gate (evidence: `supabase/functions/ai-strategy-generate/index.ts:170`, `supabase/functions/ai-strategy-generate/index.ts:185`).
Step 4 → Server loads optional context sources:
  - `agency_brains.brain_json` (monolithic agency brain) (evidence: `supabase/functions/ai-strategy-generate/index.ts:200`).
  - latest `client_onboarding_profiles` row (evidence: `supabase/functions/ai-strategy-generate/index.ts:208`).
  - latest `strategies` and `strategy_modules` (structured strategy state) (evidence: `supabase/functions/ai-strategy-generate/index.ts:216`, `supabase/functions/ai-strategy-generate/index.ts:224`).
Step 5 → Server retrieves RAG matches:
  - `clientMatches` for client doc_types (legacy list includes `client_guidelines`, `client_notes`, `approved_posts`, `ai_artifact`, `strategy_draft`) (evidence: `supabase/functions/ai-strategy-generate/index.ts:270`).
  - `agencyMatches` for agency doc_types (legacy list includes `agency_sop`, `brain_document`) (evidence: `supabase/functions/ai-strategy-generate/index.ts:271`).
Step 6 → If no matches, server returns `unknown=true` response asking for uploads (evidence: `supabase/functions/ai-strategy-generate/index.ts:310`, `supabase/functions/ai-strategy-generate/index.ts:322`).
Step 7 → Otherwise server builds prompt context and runs AI task `TaskType.STRATEGY_PLAN` (evidence: `supabase/functions/ai-strategy-generate/index.ts:383`, `supabase/functions/ai-strategy-generate/index.ts:395`).
Step 8 → Server persists a snapshot via `create_strategy_snapshot` and logs usage/runs (evidence: `supabase/functions/ai-strategy-generate/index.ts:510`, `supabase/functions/ai-strategy-generate/index.ts:583`, `supabase/functions/ai-strategy-generate/index.ts:609`).

---

## Exactly which data sources are fed into strategy generation (current truth)
`ai-strategy-generate` builds `promptContext` from:
- `Onboarding Profile:\n${JSON.stringify(onboardingProfile ?? {})}` (evidence: `supabase/functions/ai-strategy-generate/index.ts:383`).
- `Structured Strategy:\n${JSON.stringify(moduleRows ?? [])}` (evidence: `supabase/functions/ai-strategy-generate/index.ts:385`).
- `RAG Context:\n${context}` where `context` is built from retrieved chunk text (evidence: `supabase/functions/ai-strategy-generate/index.ts:386`).
- A “references section” based on brain_document matches (evidence: `supabase/functions/ai-strategy-generate/index.ts:370`).

Notably:
- It loads `agency_brains.brain_json` but does not visibly inject it into `promptContext` in the shown snippet. **UNKNOWN** if `agencyBrainRow` is used later in the file in a portion not yet inspected in this audit.
  - How to verify: search `ai-strategy-generate/index.ts` for `agencyBrainRow` usage.

---

## “References” behavior (where references come from)
- Strategy generation selects matches and builds `brainDocReferences` by joining selected `brain_document` matches to `ai_documents` rows (evidence: `supabase/functions/ai-strategy-generate/index.ts:355`, `supabase/functions/ai-strategy-generate/index.ts:364`).
- It stores citations in `ai_runs.citations.memory_citations` based on selected matches (evidence: `supabase/functions/ai-strategy-generate/index.ts:536`).

---

## AI behavior (RAG? chunking? embeddings?) — YES/NO/UNKNOWN
- **RAG used in strategy generation**: YES (retrieval + prompt context) (evidence: `supabase/functions/ai-strategy-generate/index.ts:274`, `supabase/functions/ai-strategy-generate/index.ts:386`).
- **Client brain “usable” gate exists**: YES (evidence: `supabase/functions/ai-strategy-generate/index.ts:185`).
- **Client onboarding V5 writes to client_onboarding_profiles**: NO evidence found; it writes to client_brains via edge function (evidence: `src/components/onboarding-v5/OnboardingV5Wizard.tsx:597`).
- **Client onboarding profile (V4) affects strategy generation**: YES, because `ai-strategy-generate` queries `client_onboarding_profiles` (evidence: `supabase/functions/ai-strategy-generate/index.ts:208`).

---

## “Source of truth” (status fields that determine pipeline state)
- Client brain readiness gate:
  - `client_brains.usable` and `evaluateClientBrainForStrategy(...)` decide `unknown=true` returns (evidence: `supabase/functions/ai-strategy-generate/index.ts:183`, `supabase/functions/ai-strategy-generate/index.ts:185`).
- Strategy document “active” selection:
  - `strategy_documents.is_active` is set false for all docs on snapshot creation, then new doc inserted as active (evidence: `supabase/migrations/20260108143000_strategy_snapshot_rpc.sql:41`, `supabase/migrations/20260108143000_strategy_snapshot_rpc.sql:62`).

---

## Cross-tenant risks + isolation enforcement
- Onboarding routes fetch `clients` by id in the browser; RLS must prevent cross-tenant reads (RLS policy location for clients is outside this audit’s scope) (evidence: `src/pages/ai/AiOnboardingClientV4.tsx:25`).
- Strategy generation uses service role and explicitly checks membership before proceeding (evidence: `supabase/functions/ai-strategy-generate/index.ts:157`).

---

## Explicit answers required by the mission
### Q9) Does Agency AI Setup impact client strategy generation? Where exactly?
- **YES**, via two paths:
  1) Strategy generation retrieves `brain_document` chunks as agency memory (evidence: `supabase/functions/ai-strategy-generate/index.ts:271`).
  2) Strategy generation may also use `agency_brains` (loaded at runtime) (evidence: `supabase/functions/ai-strategy-generate/index.ts:200`).

### Q10) Are Agency Brain docs embedded and used as RAG? Which tables store chunks/embeddings?
- **YES** for the modular docs:
  - stored as `ai_documents` (`doc_type='brain_document'`) with chunk rows and embeddings (evidence: `supabase/migrations/20260108123000_brain_documents_rag.sql:16`, `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:71`).

### Q11) What is the end goal, and where does current code diverge?
- End goal implied by UI copy: onboarding completion yields a ready strategy (V5 toast) (evidence: `src/components/onboarding-v5/OnboardingV5Wizard.tsx:636`).
- Divergence: V5 onboarding does not itself generate a strategy snapshot; it only ingests the client brain and navigates away (evidence: `src/components/onboarding-v5/OnboardingV5Wizard.tsx:621`).

---

## Failure modes (top 5) + how they surface
1) **Client not found / no access** → onboarding page shows “Client not found” UI (evidence: `src/pages/ai/AiOnboardingClientV4.tsx:50`).
2) **Client brain ingest fails** → onboarding wizard shows destructive toast “Failed to generate strategy. Please try again.” (evidence: `src/components/onboarding-v5/OnboardingV5Wizard.tsx:643`).
3) **Strategy generation returns unknown due to missing client brain fields** → UI must handle `unknown=true` payload (evidence: `supabase/functions/ai-strategy-generate/index.ts:197`, `src/hooks/useStrategyModules.ts:301`).
4) **Embeddings missing (OPENAI_API_KEY not configured)** → `ai-strategy-generate` returns 500 with `code=MISSING_API_KEY`; UI must surface an actionable error (evidence: `supabase/functions/ai-strategy-generate/index.ts:231`, `src/hooks/useStrategyDocuments.ts:67`).
5) **Snapshot RPC failure** → `ai-strategy-generate` returns error “Failed to save strategy snapshot” (evidence: `supabase/functions/ai-strategy-generate/index.ts:525`).

---

## Verification checklist (commands + SQL)
### Repo commands (required by request)
- `npm test`
- `npm run lint`
- `npx tsc -p tsconfig.json --noEmit`
- `npm run build`

### SQL checks (client onboarding + strategy)
```sql
-- A) Latest client brain and usable status
select id, agency_id, client_id, status, usable, updated_at
from public.client_brains
where client_id = :client_id
order by version desc
limit 3;
```

```sql
-- B) Client onboarding profile exists (if using V4 table)
select client_id, agency_id, flow_type, current_step, completed_at, updated_at
from public.client_onboarding_profiles
where client_id = :client_id;
```

```sql
-- C) Latest active strategy document for the client
select id, source, is_active, model, generation_instruction, derived_from_hash, updated_at
from public.strategy_documents
where client_id = :client_id
order by updated_at desc
limit 10;
```

```sql
-- D) Strategy modules (latest strategy_id inferred by max version)
select s.id as strategy_id, s.version_int, sm.module, sm.status, sm.updated_at
from public.strategies s
join public.strategy_modules sm on sm.strategy_id = s.id
where s.client_id = :client_id
order by s.version_int desc, sm.module;
```

---

## References behavior (what “References:” means today)
Strategy generation emits a “References:” section derived from vector matches + `ai_documents` metadata:
- `ai-strategy-generate` builds `brainDocReferences` then formats it into markdown (evidence: `supabase/functions/ai-strategy-generate/index.ts:364`, `supabase/functions/ai-strategy-generate/index.ts:370`).
- Formatter behavior: returns the literal string “References:\n(none)” if there are zero references (evidence: `supabase/functions/_shared/strategy-references.ts:90`).
- Strategy generation logs the references used into `ai_usage_logs.metadata->'brain_document_references_used'` (evidence: `supabase/functions/ai-strategy-generate/index.ts:632`).

### Verification SQL (prove references are generated and logged)
```sql
select created_at,
       endpoint,
       metadata->'brain_document_references_used' as brain_document_references_used
from public.ai_usage_logs
where client_id = :client_id
and endpoint = 'ai-strategy-generate'
order by created_at desc
limit 20;
```

---

## Cron/automation execution path (strategy generation)
`ai-strategy-generate` supports a privileged “cron mode”:
- It checks `x-cron-secret` vs env `CRON_SECRET` (evidence: `supabase/functions/ai-strategy-generate/index.ts:110`, `supabase/functions/_shared/cron.ts:5`).

### Cross-tenant risk note (cron mode)
- In cron mode, the handler selects an admin/owner user to act as; correctness depends on how that selection is scoped (verification: inspect the `CRON_SECRET` branch predicates in your deployed version) (evidence: `supabase/functions/ai-strategy-generate/index.ts:132`).

---

## Request/response shape (ai-strategy-generate)
### Request (minimum required)
- `client_id` is required; missing value returns 400 `{ error: "client_id is required" }` (evidence: `supabase/functions/ai-strategy-generate/index.ts:108`, `supabase/functions/ai-strategy-generate/index.ts:115`).

### Server-resolved scoping
- Server derives `agency_id` from `clients` by `client_id` and stores it in `agencyId` local variable (evidence: `supabase/functions/ai-strategy-generate/index.ts:120`, `supabase/functions/ai-strategy-generate/index.ts:128`).

### “unknown” response mode (observable contract)
- The handler can return `{ unknown: true, ... }` payloads for gating failures (e.g., missing embedding key / unusable client brain) (evidence: `supabase/functions/ai-strategy-generate/index.ts:35`, `supabase/functions/ai-strategy-generate/index.ts:195`).

---

## RLS + tenancy verification (strategy outputs)
RLS policy details for the strategy tables are not fully enumerated in this audit; verify directly in your DB:
- Tables written by the snapshot RPC: `strategy_documents` and `strategy_modules` (evidence: `supabase/migrations/20260108143000_strategy_snapshot_rpc.sql:3`).

```sql
-- Confirm RLS enabled and inspect policies for strategy output tables
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where tablename in ('strategies','strategy_modules','strategy_documents')
order by tablename, policyname;
```
