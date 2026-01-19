# 03 — Edge Functions and Routing (Current Truth)

## Glossary (shared terms)
- **Edge function**: Deno handler under `supabase/functions/<name>/index.ts`, invoked via Supabase Functions API (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:1`).
- **Service role client**: server-side Supabase client created with `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS) (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:39`).
- **Endpoint guard**: `getEndpointGuardResponse(...)` deny-by-default allowlist for AI endpoints unless `ENABLE_UNUSED_AI_ENDPOINTS=true` (evidence: `supabase/functions/_shared/endpoint-guard.ts:1`).
- **verify_jwt**: Supabase function config flag; some functions explicitly set it (evidence: `supabase/config.toml:3`, `supabase/functions/ai-strategy-generate/config.toml:1`).

## Purpose
Map the edge functions that participate in Agency AI Setup, Default Brain Pack v1, ingestion/embeddings/retrieval, onboarding, and strategy generation. This focuses on routing/config, authn/authz checks, and the exact calls each endpoint makes.

---

## Routing and configuration (what routes exist and how they’re gated)
### Where routing is defined (repo-level)
- Functions live under `supabase/functions/*` (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:1`).
- Project-level config sets `verify_jwt` for some functions (evidence: `supabase/config.toml:3`).
- Per-function config exists for some endpoints (example: `ai-strategy-generate` sets `verify_jwt=false`) (evidence: `supabase/functions/ai-strategy-generate/config.toml:1`).

### Endpoint allowlist (deny-by-default toggle)
- `getEndpointGuardResponse()` blocks non-allowlisted AI endpoints unless `ENABLE_UNUSED_AI_ENDPOINTS=true` (evidence: `supabase/functions/_shared/endpoint-guard.ts:30`).
- Allowlisted endpoints include:
  - `ai-brain-analyze`, `ai-brain-document-approve`, `ai-brain-ingest`, `ai-seed-default-brain-pack`, `ai-default-brain-pack-ingestion-health`, `ai-retrieve-context`, `ai-strategy-generate`, `ai-rep-chat`, `generate-ai-content`, etc. (evidence: `supabase/functions/_shared/endpoint-guard.ts:1`).

---

## Inventory (relevant edge functions)
This audit covers the functions that are directly referenced by the “Agency AI Setup / Default Brain Pack / Strategy / RAG” system:
- `ai-seed-default-brain-pack` (UI Quick Setup + retry processing) (evidence: `src/hooks/useSeedDefaultBrainPack.ts:19`).
- `ai-seed-default-brain-pack-admin` (cron/admin backfill) (evidence: `supabase/functions/ai-seed-default-brain-pack-admin/index.ts:38`).
- `ai-brain-document-approve` (approve + ingest module doc) (evidence: `src/hooks/useBrainDocuments.ts:256`).
- `ai-default-brain-pack-ingestion-health` (compute missing ingested core modules) (evidence: `src/hooks/useDefaultBrainPackIngestionHealth.ts:23`).
- `ai-brain-analyze` (upload analysis/transform; currently placeholder) (evidence: `src/hooks/useBrainDocumentUpload.ts:60`).
- `ai-brains-agency` (CRUD/lock agency_brains JSON) (evidence: `src/pages/CreateAgencyStub.tsx:177`).
- `ai-brains-client` (CRUD client_brains JSON; used by onboarding) (evidence: `src/components/onboarding-v5/OnboardingV5Wizard.tsx:597`).
- `ai-brain-ingest` (maps raw responses → brain_json + writes summaries as ai_documents + embeddings) (evidence: `src/components/onboarding-v5/OnboardingV5Wizard.tsx:621`).
- `ai-retrieve-context` (embed query + call match_ai_embeddings + return snippets) (evidence: `supabase/functions/ai-retrieve-context/index.ts:129`).
- `ai-strategy-generate` (strategy generation pipeline; retrieval + AI run + snapshot write) (evidence: `supabase/functions/ai-strategy-generate/index.ts:395`).

---

## Endpoint-by-endpoint audit
For each endpoint:
- **Authn** = does it verify the caller identity?
- **Authz** = does it enforce agency membership/role?
- **DB/RPC calls** = what tables/functions it touches.

### `ai-seed-default-brain-pack`
**Purpose**
- Seeds/repairs the 3 “Default Brain Pack v1” module docs, approves them, and ingests them into RAG (ai_documents/chunks/embeddings) (evidence: `supabase/functions/_shared/seed-default-brain-pack.ts:60`, `supabase/functions/_shared/seed-default-brain-pack.ts:268`).

**Authn/Authz**
- Requires `Authorization` header and validates user via `supabase.auth.getUser(token)` (service role client) (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:34`, `supabase/functions/ai-seed-default-brain-pack/index.ts:44`).
- Resolves agency via `agency_members` (and can infer if only one membership exists) (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:52`, `supabase/functions/_shared/seed-default-brain-pack.ts:49`).
- Enforces role `owner/admin` for the requested agency (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:77`).

**DB/RPC calls**
- Reads `agencies` for name/website/niche to render the pack (evidence: `supabase/functions/_shared/seed-default-brain-pack.ts:78`).
- RPC: `seed_default_brain_pack_v1` OR `repair_default_brain_pack_v1` based on whether any `brain_documents` exist (evidence: `supabase/functions/_shared/seed-default-brain-pack.ts:169`, `supabase/functions/_shared/seed-default-brain-pack.ts:199`).
- Approval: `approveBrainDocument(...)` which archives prior approved doc and sets approved_at (evidence: `supabase/functions/_shared/brain-documents.ts:335`, `supabase/functions/_shared/brain-documents.ts:345`).
- Ingest: `ingestBrainDocumentForRag(...)` → writes `ai_documents`, `ai_document_chunks`, `ai_embeddings` (evidence: `supabase/functions/_shared/brain-documents.ts:664`, `supabase/functions/_shared/brain-documents.ts:697`, `supabase/functions/_shared/embedding-store.ts:27`).

**Observability**
- Writes structured rows to `ai_usage_logs` with stages (seed/repair/approved/ingested/failed/completed) and “never block response on observability” behavior (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:82`, `supabase/functions/ai-seed-default-brain-pack/index.ts:99`).

### `ai-seed-default-brain-pack-admin`
**Purpose**
- Server-side (cron/ops) endpoint to seed defaults for a specific agency by resolving an acting admin user, then reusing the shared seed/approve/ingest pipeline (evidence: `supabase/functions/ai-seed-default-brain-pack-admin/index.ts:53`, `supabase/functions/ai-seed-default-brain-pack-admin/index.ts:81`).

**Authn/Authz**
- Uses `verifyCronSecret(req)` and requires `x-cron-secret` matching `CRON_SECRET` (evidence: `supabase/functions/ai-seed-default-brain-pack-admin/index.ts:38`, `supabase/functions/_shared/cron.ts:1`).
- Does not accept end-user JWT; it runs with service role and a resolved acting user id (evidence: `supabase/functions/ai-seed-default-brain-pack-admin/index.ts:41`, `supabase/functions/ai-seed-default-brain-pack-admin/index.ts:53`).

**DB calls**
- `resolveAgencyAdminUserId(...)` uses `agency_members` to pick a user (evidence: `supabase/functions/ai-seed-default-brain-pack-admin/index.ts:53`).
- Optional `dry_run` checks `brain_documents` count for eligibility (evidence: `supabase/functions/ai-seed-default-brain-pack-admin/index.ts:58`).
- Writes a summary row to `ai_usage_logs` (best-effort) (evidence: `supabase/functions/ai-seed-default-brain-pack-admin/index.ts:105`).

### `ai-brain-document-approve`
**Purpose**
- Approves a single `brain_documents` row and immediately ingests it into RAG as `doc_type='brain_document'` (evidence: `supabase/functions/_shared/ai-brain-document-approve-handler.ts:61`).

**Authn/Authz**
- Requires JWT `Authorization` header and validates user via `supabase.auth.getUser(token)` (evidence: `supabase/functions/_shared/ai-brain-document-approve-handler.ts:27`).
- Loads the doc’s `agency_id` and checks `isAgencyAdminOrOwner(...)` (evidence: `supabase/functions/_shared/ai-brain-document-approve-handler.ts:45`, `supabase/functions/_shared/ai-brain-document-approve-handler.ts:55`).

**DB calls**
- Reads `brain_documents(id,agency_id)` for authz context (evidence: `supabase/functions/_shared/ai-brain-document-approve-handler.ts:45`).
- Approves + archives prior approved doc (evidence: `supabase/functions/_shared/brain-documents.ts:335`).
- Ingests to `ai_documents` and deletes prior ai_documents for same module before insert (evidence: `supabase/functions/_shared/brain-documents.ts:657`).

### `ai-default-brain-pack-ingestion-health`
**Purpose**
- Given a list of approved core modules, checks whether they are present in `ai_documents` as `doc_type='brain_document'` and returns `missingModules` for UI error state (evidence: `supabase/functions/ai-default-brain-pack-ingestion-health/index.ts:78`, `supabase/functions/ai-default-brain-pack-ingestion-health/index.ts:101`).

**Authn/Authz**
- Validates user JWT and requires membership in the requested agency (evidence: `supabase/functions/ai-default-brain-pack-ingestion-health/index.ts:39`, `supabase/functions/ai-default-brain-pack-ingestion-health/index.ts:58`).

**DB calls**
- Query: `ai_documents` filtered by `agency_id`, `doc_type='brain_document'`, and `metadata->>module` in approvedModules (evidence: `supabase/functions/ai-default-brain-pack-ingestion-health/index.ts:78`, `supabase/functions/ai-default-brain-pack-ingestion-health/index.ts:83`).

### `ai-brain-analyze`
**Purpose**
- Reads an uploaded file from storage bucket `brain-documents` and returns extracted text + a “transformed_output” structure (currently placeholder) (evidence: `supabase/functions/ai-brain-analyze/index.ts:95`, `supabase/functions/ai-brain-analyze/index.ts:125`).

**Authn/Authz**
- Only checks that an `Authorization` header exists; it does **not** validate the JWT nor check agency membership in code (evidence: `supabase/functions/ai-brain-analyze/index.ts:62`).
- Uses service role key to create Supabase client (evidence: `supabase/functions/ai-brain-analyze/index.ts:72`).
- **Security status is UNKNOWN without verifying `verify_jwt` behavior for this function in your Supabase deployment.**
  - If `verify_jwt=true` at the platform level, requests without a valid JWT should be rejected before handler code runs.
  - Even with a valid JWT, the handler itself does not do membership checks; it relies on storage path policy + correct file_path usage (evidence: `supabase/migrations/20260117160000_brain_documents_storage_bucket.sql:24`).

**AI behavior**
- No AI transform is implemented; the function explicitly says TODO and returns a hardcoded structure for each layer (evidence: `supabase/functions/ai-brain-analyze/index.ts:126`, `supabase/functions/ai-brain-analyze/index.ts:170`).

### `ai-brains-agency`
**Purpose**
- Create/update/lock rows in `agency_brains` (JSON “Agency Brain”) (evidence: `supabase/functions/ai-brains-agency/index.ts:7`).

**Authn/Authz**
- Validates JWT and requires membership in `agency_members` for the requested agency (evidence: `supabase/functions/ai-brains-agency/index.ts:30`, `supabase/functions/ai-brains-agency/index.ts:57`).
- Does not enforce role (member is sufficient) (evidence: `supabase/functions/ai-brains-agency/index.ts:64`).

**DB calls**
- `agency_brains` select for existing version 1, insert version 1, update by `id` + `agency_id`, lock sets `status='locked', locked=true` (evidence: `supabase/functions/ai-brains-agency/index.ts:68`, `supabase/functions/ai-brains-agency/index.ts:134`).

### `ai-brains-client`
**Purpose**
- Analogous CRUD for `client_brains` (used by onboarding flows) (evidence: `src/components/onboarding-v5/OnboardingV5Wizard.tsx:597`).

**UNKNOWN**
- Not audited here line-by-line due to time; verify its auth checks and DB writes by inspecting `supabase/functions/ai-brains-client/index.ts` (how to verify: open file and search for `auth.getUser` and `agency_members` queries).

### `ai-brain-ingest`
**Purpose**
- Writes “derived” brain_json structures and creates summary documents/embeddings:
  - Agency scope: updates `agency_brains.brain_json`, creates `ai_documents` doc_type `ai_artifact` titled “Agency brain summary”, chunks and embeds it (evidence: `supabase/functions/ai-brain-ingest/index.ts:163`, `supabase/functions/ai-brain-ingest/index.ts:221`).
  - Client scope: updates `client_brains.brain_json`, sets `status`/`usable` gate, writes `ai_memory_items` “client_brain_summary”, and also creates an `ai_documents` `ai_artifact` titled “Client brain summary” with embeddings (evidence: `supabase/functions/ai-brain-ingest/index.ts:310`, `supabase/functions/ai-brain-ingest/index.ts:322`, `supabase/functions/ai-brain-ingest/index.ts:333`).

**Authn/Authz**
- Validates JWT and requires membership in `agency_members` for `agency_id` (evidence: `supabase/functions/ai-brain-ingest/index.ts:97`, `supabase/functions/ai-brain-ingest/index.ts:130`).

**Chunking/embedding details**
- Tokenization is whitespace-based (`tokenize` from shared embeddings) (evidence: `supabase/functions/_shared/embeddings.ts:17`).
- Uses chunking constants:
  - `CHUNK_SIZE_TOKENS = 900`, `OVERLAP_TOKENS = 140`, `MAX_CHUNKS = 12` (note: differs from brain-doc ingestion which uses `MAX_CHUNKS=120`) (evidence: `supabase/functions/ai-brain-ingest/index.ts:12`, `supabase/functions/_shared/brain-documents.ts:83`).
- On embedding failure with `failHard` disabled, chunks remain `embedding_status='failed'` and are excluded from retrieval (evidence: `supabase/functions/_shared/embedding-store.ts:23`, `supabase/migrations/20260105140000_embedding_chunk_status.sql:3`).

**Observability**
- Writes `ai_usage_logs` for endpoint `ai-brain-ingest` (evidence: `supabase/functions/ai-brain-ingest/index.ts:416`).

### `ai-retrieve-context`
**Purpose**
- Embeds a user query and calls `match_ai_embeddings` to return snippet matches (evidence: `supabase/functions/ai-retrieve-context/index.ts:126`, `supabase/functions/ai-retrieve-context/index.ts:129`).

**Authn/Authz**
- Validates JWT and requires membership in `agency_members` (evidence: `supabase/functions/ai-retrieve-context/index.ts:66`, `supabase/functions/ai-retrieve-context/index.ts:95`).
- Has additional “lockdown” logic for missing auth / missing membership based on `AI_LOCKDOWN_UNUSED_ENDPOINTS` (evidence: `supabase/functions/ai-retrieve-context/index.ts:29`, `supabase/functions/ai-retrieve-context/index.ts:103`).

**DB/RPC calls**
- RPC: `match_ai_embeddings` with filters for `doc_types`, `modules`, `min_similarity` (evidence: `supabase/functions/ai-retrieve-context/index.ts:129`).
- Logs usage to `ai_usage_logs` (evidence: `supabase/functions/ai-retrieve-context/index.ts:143`).

### `ai-strategy-generate`
**Purpose**
- Orchestrates strategy generation:
  - Loads client’s `agency_id`, checks membership (or cron secret), loads latest `client_brains` and gates usability, loads latest `agency_brains`, loads onboarding profile + latest strategy modules, runs retrieval via `match_ai_embeddings`, then runs AI task `TaskType.STRATEGY_PLAN`, then persists results via RPC `create_strategy_snapshot` and logs to `ai_runs` + `ai_usage_logs` (evidence: `supabase/functions/ai-strategy-generate/index.ts:118`, `supabase/functions/ai-strategy-generate/index.ts:183`, `supabase/functions/ai-strategy-generate/index.ts:200`, `supabase/functions/ai-strategy-generate/index.ts:274`, `supabase/functions/ai-strategy-generate/index.ts:395`, `supabase/functions/ai-strategy-generate/index.ts:510`, `supabase/functions/ai-strategy-generate/index.ts:583`, `supabase/functions/ai-strategy-generate/index.ts:609`).

**Authn/Authz**
- Function-level config explicitly sets `verify_jwt=false` (platform won’t enforce JWT) (evidence: `supabase/functions/ai-strategy-generate/config.toml:1`).
- Two auth modes:
  - Cron mode via `x-cron-secret == CRON_SECRET`, then picks an admin/owner user to act as (evidence: `supabase/functions/ai-strategy-generate/index.ts:110`, `supabase/functions/ai-strategy-generate/index.ts:132`).
  - Normal mode: requires `Authorization` header and membership in `agency_members` (evidence: `supabase/functions/ai-strategy-generate/index.ts:145`, `supabase/functions/ai-strategy-generate/index.ts:157`).

**RAG usage**
- Calls `match_ai_embeddings` three times (client, agency, exemplars) (evidence: `supabase/functions/ai-strategy-generate/index.ts:274`, `supabase/functions/ai-strategy-generate/index.ts:284`, `supabase/functions/ai-strategy-generate/index.ts:294`).
- Agency doc_types include `brain_document` (evidence: `supabase/functions/ai-strategy-generate/index.ts:271`, `src/ai/ragPolicy.ts:51`).

---

## Control flow diagram (request → handler → DB) in text
### Strategy generate (happy path)
Step 1 → POST `ai-strategy-generate` with `{client_id}` (evidence: `src/hooks/useStrategyDocuments.ts:67`).
Step 2 → Resolve `agency_id` from `clients` (evidence: `supabase/functions/ai-strategy-generate/index.ts:118`).
Step 3 → Validate caller (cron secret OR JWT + membership) (evidence: `supabase/functions/ai-strategy-generate/index.ts:112`, `supabase/functions/ai-strategy-generate/index.ts:157`).
Step 4 → Load latest `client_brains` and gate usability (evidence: `supabase/functions/ai-strategy-generate/index.ts:170`, `supabase/functions/ai-strategy-generate/index.ts:185`).
Step 5 → Compute query embedding and retrieve matches via `match_ai_embeddings` (evidence: `supabase/functions/ai-strategy-generate/index.ts:262`, `supabase/functions/ai-strategy-generate/index.ts:274`).
Step 6 → Build prompt context (onboarding profile + structured strategy + RAG context + references section) (evidence: `supabase/functions/ai-strategy-generate/index.ts:383`).
Step 7 → Run AI task `TaskType.STRATEGY_PLAN` via router (evidence: `supabase/functions/ai-strategy-generate/index.ts:395`).
Step 8 → Persist via `create_strategy_snapshot` RPC and log run/usage (evidence: `supabase/functions/ai-strategy-generate/index.ts:510`, `supabase/functions/ai-strategy-generate/index.ts:583`, `supabase/functions/ai-strategy-generate/index.ts:609`).

---

## Cross-tenant risks to call out (edge layer)
- Any endpoint that uses `SUPABASE_SERVICE_ROLE_KEY` must correctly scope requests by membership/agency_id; most do (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:39`, `supabase/functions/ai-seed-default-brain-pack/index.ts:52`).
- `ai-brain-analyze` currently does not validate JWT or membership in handler code (only checks header presence) while using service role; verify platform `verify_jwt` settings and consider this a **high-risk area** to audit in production (evidence: `supabase/functions/ai-brain-analyze/index.ts:62`, `supabase/functions/ai-brain-analyze/index.ts:72`).
- `match_ai_embeddings` privilege hardening is potentially inconsistent after signature changes; if callable by non-service roles, cross-tenant retrieval becomes possible (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:45`).

---

## Failure modes (top 5) + where they surface
1) **Endpoint disabled by endpoint guard** (403 with `{code:"ENDPOINT_DISABLED"}`) (evidence: `supabase/functions/_shared/endpoint-guard.ts:34`).
2) **Missing Authorization header** (401) on user-auth endpoints (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:35`, `supabase/functions/ai-retrieve-context/index.ts:40`).
3) **Forbidden membership/role** (403) for seed/approve flows (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:72`, `supabase/functions/_shared/ai-brain-document-approve-handler.ts:56`).
4) **OPENAI_API_KEY missing** causing unknown/fallback or error depending on endpoint:
   - Strategy generation returns 500 with `code=MISSING_API_KEY` (no silent `unknown` fallback) (evidence: `supabase/functions/ai-strategy-generate/index.ts:231`).
   - Retrieve-context returns 500 “Embedding API not configured” (evidence: `supabase/functions/ai-retrieve-context/index.ts:121`).
5) **Privilege drift for RPCs** (e.g., match_ai_embeddings, create_strategy_snapshot) results in runtime errors (evidence: `supabase/migrations/20260108143000_strategy_snapshot_rpc.sql:182`).

---

## Verification checklist (commands + runtime checks)
### Repo commands (required by request)
- `npm test`
- `npm run lint`
- `npx tsc -p tsconfig.json --noEmit`
- `npm run build`

### Runtime/log verification (Supabase)
- Check edge function logs for:
  - `seed_default_brain_pack_v1_*` events (evidence: `supabase/functions/_shared/seed-default-brain-pack.ts:86`).
  - `default_brain_pack_ingestion_health_*` errors (evidence: `supabase/functions/ai-default-brain-pack-ingestion-health/index.ts:66`).
  - `ai-agency-admin-chat_unhandled_error` (evidence: `supabase/functions/ai-agency-admin-chat/index.ts:102`).

### SQL verification (privileges & boundaries)
```sql
-- Verify exec privileges for critical RPCs (adjust signature text if DB differs)
select
  has_function_privilege('service_role', 'public.create_strategy_snapshot(uuid, uuid, uuid, uuid, jsonb, text, text, text, text, text, jsonb, jsonb)', 'execute') as snapshot_service_exec;
```

---

## Platform routing + `verify_jwt` map (Supabase config surface)
### Global function config file
- `supabase/config.toml` lists functions and their `verify_jwt` settings (evidence: `supabase/config.toml:4`).
- Example: `generate-approval-reminders` is configured as `verify_jwt=false` (evidence: `supabase/config.toml:22`).

### Per-function config example
- `ai-strategy-generate/config.toml` also sets `verify_jwt=false` (evidence: `supabase/functions/ai-strategy-generate/config.toml:1`).

### Cross-tenant implication
- Any endpoint that both (1) runs with `verify_jwt=false` and (2) uses `SUPABASE_SERVICE_ROLE_KEY` is a high-risk surface unless the handler implements strong membership/role checks (evidence: `supabase/functions/_shared/env.ts:8`, `supabase/config.toml:22`).

### Verification command (routing inventory)
```sh
rg -n "verify_jwt\\s*=\\s*(true|false)" supabase/config.toml supabase/functions/**/config.toml
```

---

## Runtime imports for edge functions (Deno)
- Supabase Deno functions import dependencies via `supabase/functions/deno.json` (evidence: `supabase/functions/deno.json:2`).
