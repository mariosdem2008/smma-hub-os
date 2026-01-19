# 02 — DB Schema, RLS, and Migrations (Current Truth)

## Glossary (shared terms)
- **Agency / Tenant**: `public.agencies` row; most multi-tenant isolation keys are `agency_id` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:7`).
- **Agency member**: `public.agency_members` row connecting `user_id` to `agency_id` + `role` (used by many RLS policies) (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:107`).
- **Agency Brain (JSON)**: `public.agency_brains.brain_json` (monolithic JSON) (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:7`).
- **Agency Brain calibration state**: `public.agency_brains.calibration_state` JSONB (server-side idempotent setup tracking) (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:407`).
- **Client Brain (JSON)**: `public.client_brains.brain_json` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:20`).
- **Brain Document (module doc)**: `public.brain_documents` row, one per “module” + status/versioning (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:39`).
- **Brain Document version**: immutable audit rows in `public.brain_document_versions` (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:57`).
- **RAG “document”**: `public.ai_documents` row (content + metadata + doc_type) (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:34`).
- **RAG chunks**: `public.ai_document_chunks` rows per `ai_documents.id` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:61`).
- **RAG embeddings**: `public.ai_embeddings` rows per chunk with `vector(1536)` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:71`).
- **Vector retrieval RPC**: `public.match_ai_embeddings(...)` SQL function (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:11`).
- **Usage logging**: `public.ai_usage_logs` rows for endpoint/model/tokens/latency/unknown (evidence: `supabase/migrations/20251224090000_brain_spine_v1.sql:16`, `supabase/migrations/20251224110000_expand_ai_usage_logs.sql:1`, `supabase/migrations/20260116210500_ai_usage_logs_metadata.sql:3`).

## Purpose
This audit inventories the *current* database objects involved in Agency AI Setup, Default Brain Pack v1, onboarding, strategy generation, and RAG (vector retrieval). It focuses on the tables/functions actually referenced by the app and edge functions today, plus their RLS posture and migration origin.

---

## Data model (tables, key columns, RLS status)
Below are the DB objects that are directly referenced by the current flows (UI hooks + edge functions).

### `public.brain_documents`
- **Why it exists**: stores the modular “Agency AI Setup” content by module and status (draft/pending/approved/archived) (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:38`, `src/pages/agency/AISetup.tsx:10`).
- **Key columns**
  - `agency_id` tenant key (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:41`).
  - `module` enum `public.brain_module` (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:10`).
  - `status` enum `public.brain_document_status` (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:23`).
  - `content_json` JSONB payload (UI stores either structured content or `{raw_content: ...}`) (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:44`, `src/hooks/useBrainDocumentUpload.ts:164`).
  - `version`, `approved_at`, `approved_by` (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:46`).
- **Uniqueness constraint**
  - “Only one approved per module per agency” via partial unique index (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:74`).
- **RLS**
  - RLS enabled (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:99`).
  - SELECT allowed for agency members (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:103`).
  - INSERT/UPDATE restricted to owner/admin (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:114`, `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:126`).
  - DELETE restricted to owner (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:138`).

### `public.brain_document_versions`
- **Why it exists**: immutable version history for brain documents (used by UI history and audit trail) (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:56`, `src/hooks/useBrainDocuments.ts:112`).
- **Key columns**: `document_id`, `version`, `content_json`, `change_summary`, `created_by` (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:59`).
- **RLS**
  - Enabled (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:100`).
  - SELECT allowed when user can access parent doc via membership join (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:150`).
  - INSERT allowed to owner/admin for parent doc (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:162`).

### `public.agency_brains`
- **Why it exists**: stores monolithic agency-level brain JSON; used by admin setup chat + agency onboarding + strategy generation context (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:7`, `supabase/functions/ai-strategy-generate/index.ts:200`, `src/pages/CreateAgencyStub.tsx:177`).
- **Key columns**
  - `agency_id`, `version`, `status`, `locked` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:9`).
  - `brain_json`, `json_diff` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:13`).
  - `calibration_state` JSONB (added later) (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:407`).
- **RLS**
  - Initially: member-based select/insert/update/delete policies (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:174`).
  - Later changed to “service_role only select” at least once (migration overrides select policy) (evidence: `supabase/migrations/20251224103000_strategy_docs_and_embeddings.sql:66`).
  - **Current truth warning**: multiple migrations modify these policies; verify effective policies in the live DB (see verification SQL).

### `public.client_brains`
- **Why it exists**: stores monolithic client-level brain JSON; used as strategy generation “gate” input and as a source for summaries/artifacts on ingest (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:20`, `supabase/functions/ai-strategy-generate/index.ts:170`, `supabase/functions/ai-brain-ingest/index.ts:315`).
- **Key columns**
  - `agency_id`, `client_id`, `brain_json`, `status`, `usable` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:22`, `supabase/migrations/20251224090000_brain_spine_v1.sql:3`).
- **RLS**
  - Initially member-based policies (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:190`).
  - Later changed to “service_role only select” at least once (evidence: `supabase/migrations/20251224103000_strategy_docs_and_embeddings.sql:71`).
  - **Current truth warning**: verify effective policies in the live DB.

### `public.ai_documents`
- **Why it exists**: canonical “AI document” table for all ingested artifacts (uploads, strategy drafts, brain docs, summaries) used by chunking/embeddings and retrieval (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:34`).
- **Key columns**
  - `agency_id`, `client_id`, `doc_type`, `title`, `content`, `extracted_text` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:36`).
  - `source` JSONB and optional `source_url` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:42`).
  - `metadata` JSONB (used heavily; e.g., brain doc module/status/version stored here) (evidence: `supabase/functions/_shared/brain-documents.ts:674`).
- **Doc type check constraint**
  - Introduced with a set of doc_types (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:51`).
  - Later expanded to include `strategy_draft` (evidence: `supabase/migrations/20251224103000_strategy_docs_and_embeddings.sql:7`).
  - Later expanded to include `brain_document` (evidence: `supabase/migrations/20260108123000_brain_documents_rag.sql:7`).
- **RLS**
  - Member-based select/insert/update/delete policies exist (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:206`).
  - Retrieval is typically done via service-role edge functions (evidence: `supabase/functions/ai-strategy-generate/index.ts:100`).

### `public.ai_document_chunks`
- **Why it exists**: stores tokenized chunk text + metadata per ai_document for retrieval citations (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:61`).
- **Key columns**: `document_id`, `chunk_index`, `chunk_text`, `token_count`, `chunk_meta` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:63`).
- **Embedding status**
  - `embedding_status` column (ok/failed) added later and used by retrieval to filter failed chunks (evidence: `supabase/migrations/20260105140000_embedding_chunk_status.sql:3`, `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:46`).

### `public.ai_embeddings`
- **Why it exists**: pgvector store for chunk embeddings; used by `match_ai_embeddings` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:71`).
- **Key columns**: `agency_id`, `client_id`, `doc_type`, `document_id`, `chunk_id`, `embedding vector(1536)`, `model` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:73`).
- **RLS**
  - Member-based policies exist in baseline migration (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:165`).
  - Later changed to “service_role only select” at least once (evidence: `supabase/migrations/20251224103000_strategy_docs_and_embeddings.sql:76`).
  - **Current truth warning**: verify effective policies in the live DB.

### `public.match_ai_embeddings(...)` (RPC)
- **Why it exists**: similarity search over embeddings joined to chunks/documents (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:11`).
- **Filters that matter**
  - Filters out failed chunk embeddings: `c.embedding_status = 'ok'` (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:46`).
  - Optional `p_client_id`, `p_doc_types`, `p_modules` filters (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:47`, `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:49`).
  - Brain-document-only rule: only return `doc_type='brain_document'` when `ai_documents.metadata->>'status'='approved'` (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:50`).
  - Similarity threshold and hard cap `least(p_match_count, 12)` (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:51`).
- **Privilege hardening drift risk**
  - There is an explicit “service_role only” grant for an *older* signature (evidence: `supabase/migrations/20251224133000_harden_match_ai_embeddings_exec.sql:27`).
  - The function is later dropped/recreated with a *different signature* that includes `p_modules` and `p_min_similarity` (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:11`).
  - **UNKNOWN whether the new signature is service-role-only in production.** Verify in the DB (see verification SQL).

### `public.ai_usage_logs`
- **Why it exists**: structured usage tracking across endpoints (seed/repair, retrieval, ingest, strategy generation) (evidence: `supabase/migrations/20251224090000_brain_spine_v1.sql:16`, `supabase/functions/ai-seed-default-brain-pack/index.ts:84`, `supabase/functions/ai-retrieve-context/index.ts:143`, `supabase/functions/ai-strategy-generate/index.ts:186`).
- **Columns (migration history)**
  - Initial: `agency_id`, `client_id`, `endpoint`, `model`, `tokens_estimate`, `created_at` (evidence: `supabase/migrations/20251224090000_brain_spine_v1.sql:16`).
  - Added: `tokens_in`, `tokens_out`, `latency_ms`, `unknown` (evidence: `supabase/migrations/20251224110000_expand_ai_usage_logs.sql:1`).
  - Added: `user_id`, `metadata` (evidence: `supabase/migrations/20260116210500_ai_usage_logs_metadata.sql:3`).
- **RLS**
  - Member-based select/insert/update/delete policies exist (evidence: `supabase/migrations/20251224090000_brain_spine_v1.sql:48`).

### `public.ai_runs`
- **Why it exists**: durable run logs (success, tokens, cost, citations) for some AI endpoints (strategy generation writes here) (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:97`, `supabase/functions/ai-strategy-generate/index.ts:419`).
- **Key columns**: `agency_id`, `client_id`, `user_id`, `model`, `tokens_in`, `tokens_out`, `cost_usd`, `success`, `citations`, `unknown` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:99`, `supabase/functions/ai-strategy-generate/index.ts:419`).

### `public.ai_memory_items`
- **Why it exists**: stores “memory” summaries/items; client brain ingest writes a client summary here (evidence: `supabase/migrations/20251224090000_brain_spine_v1.sql:6`, `supabase/functions/ai-brain-ingest/index.ts:322`).
- **RLS**: member-based select/insert/update/delete (evidence: `supabase/migrations/20251224090000_brain_spine_v1.sql:32`).

### `public.agency_onboarding_sessions`
- **Why it exists**: stores static agency onboarding wizard progress + answers (CreateAgencyStub) (evidence: `supabase/migrations/20251225210000_agency_onboarding_and_create_agency_rpc.sql:4`, `src/pages/CreateAgencyStub.tsx:140`).
- **RLS**: members can select; insert requires `user_id=auth.uid()`; update by membership (evidence: `supabase/migrations/20251225210000_agency_onboarding_and_create_agency_rpc.sql:24`).

### Strategy OS tables
These are used by the Strategy UI and by `ai-strategy-generate` when reading/writing strategy snapshots.
- `public.strategy_modules` (module content + status) (evidence: `supabase/migrations/20251229100000_strategy_os.sql:33`).
- `public.strategies` (versioned strategy container) (evidence: `supabase/migrations/20251230090000_strategy_os_ops.sql:4`).
- `public.strategy_documents` (AI or uploaded strategy docs; active flag) (evidence: `supabase/migrations/20260106120000_strategy_documents.sql:3`, `src/hooks/useStrategyDocuments.ts:15`).
- `public.create_strategy_snapshot(...)` RPC (atomic write of strategy doc + modules + optional decisions/tasks) (evidence: `supabase/migrations/20260108143000_strategy_snapshot_rpc.sql:3`, `supabase/functions/ai-strategy-generate/index.ts:510`).

---

## Storage (brain-documents uploads)
- Bucket `brain-documents` is created for Agency AI Setup uploads and is referenced by the `ai-brain-analyze` function (evidence: `supabase/migrations/20260117160000_brain_documents_storage_bucket.sql:4`, `supabase/functions/ai-brain-analyze/index.ts:96`).
- Storage RLS policies scope access by `agency_id` encoded in the object path prefix (`{agency_uuid}/...`) (evidence: `supabase/migrations/20260117160000_brain_documents_storage_bucket.sql:24`).

---

## “Source of truth” (which DB fields decide status)
- **Module (AI Setup) status**: `brain_documents.status` + `brain_documents.updated_at` decide which doc is “effective” in the UI (draft/pending_approval/approved) (evidence: `src/pages/agency/AISetup.tsx:51`, `src/hooks/useBrainDocuments.ts:321`).
- **Module “active” uniqueness**: partial unique index on `(agency_id,module)` when `status='approved'` (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:74`).
- **RAG “ingestion health” for default modules**: presence of `ai_documents` rows with `doc_type='brain_document'` and `metadata.module` for approved core modules; absence is surfaced as UI “error” state (evidence: `supabase/functions/ai-default-brain-pack-ingestion-health/index.ts:78`, `src/pages/agency/AISetup.tsx:63`).
- **Client brain usability gate**: `client_brains.usable` and the server-side evaluation result gate whether strategy generation returns `unknown=true` (evidence: `supabase/functions/ai-strategy-generate/index.ts:170`, `supabase/functions/ai-strategy-generate/index.ts:185`).

---

## Cross-tenant isolation and risks (what is enforced vs. UNKNOWN)
### Enforced (documented in migrations / code)
- **RLS membership checks** exist for many tables and generally scope by `agency_id in (select agency_id from agency_members where user_id=auth.uid())` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:206`, `supabase/migrations/20251224090000_brain_spine_v1.sql:34`).
- **Brain documents edit/approve is role-gated**: only owner/admin can insert/update docs (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:114`).
- **Storage “brain-documents” bucket is path-scoped** by agency UUID prefix (evidence: `supabase/migrations/20260117160000_brain_documents_storage_bucket.sql:26`).

### Risks / UNKNOWNs (must verify)
- **`match_ai_embeddings` privilege drift** after signature changes (see earlier section). If callable by `anon`/`authenticated`, any client with an embedding vector and an `agency_id` could query cross-tenant memory unless additional checks exist in SQL (the function filters only by `d.agency_id = p_agency_id`) (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:45`).
  - **Status**: UNKNOWN until you run `has_function_privilege(...)` checks in the target DB.
- **Agency/client brain SELECT policies** are modified across migrations (service-role-only select appears at least once). The effective policy set in production is UNKNOWN without inspecting `pg_policies` (evidence: `supabase/migrations/20251224103000_strategy_docs_and_embeddings.sql:66`).

---

## AI behavior in the DB layer (RAG? chunking? embeddings?)
- **Embeddings table exists and is used**: chunk embeddings are written to `ai_embeddings.embedding vector(1536)` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:78`, `supabase/functions/_shared/embedding-store.ts:27`).
- **Chunking is a simple whitespace tokenizer** (not a tokenizer matching model tokenization): `tokenize()` splits on whitespace (evidence: `supabase/functions/_shared/embeddings.ts:17`).
- **Retrieval is real vector search**: `match_ai_embeddings` orders by cosine distance `<=>` and returns chunks (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:38`).

---

## Failure modes (top 5, DB-centric)
1) **RLS denies reads/writes** (403/empty data) when `agency_members` rows are missing or user is not member (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:107`).
2) **`match_ai_embeddings` EXECUTE privilege mismatch** after signature changes → edge functions fail at runtime when calling RPC (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:3`).
3) **Doc type constraint violations** when inserting ai_documents with a doc_type not in the check constraint (evidence: `supabase/migrations/20260108123000_brain_documents_rag.sql:7`).
4) **Missing storage bucket** (“Bucket not found”) breaks uploads; UI has a fallback but loses file refs (evidence: `src/hooks/useBrainDocumentUpload.ts:49`).
5) **Embedding failures** create chunks with `embedding_status='failed'` which are excluded from retrieval (leading to “unknown” responses downstream) (evidence: `supabase/functions/_shared/embedding-store.ts:23`, `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:46`).

---

## Verification checklist (commands + SQL)
### Repo commands (required by request)
- `npm test`
- `npm run lint`
- `npx tsc -p tsconfig.json --noEmit`
- `npm run build`

### SQL checks (copy/paste into Supabase SQL editor)
#### Default Brain Pack v1: brain docs + approval
```sql
-- 1) Core modules + status + approvals (per agency)
select agency_id, module, status, approved_at, version, updated_at
from public.brain_documents
where module in ('bootstrap','rep_policy','quality_bar')
order by agency_id, module, updated_at desc;
```

```sql
-- 2) Version rows exist
select document_id, count(*) as versions
from public.brain_document_versions
group by document_id
order by versions desc;
```

#### RAG ingestion lineage: brain docs -> ai_documents -> chunks -> embeddings
```sql
-- 3) ai_documents for brain documents
select id, agency_id, doc_type, title, metadata
from public.ai_documents
where doc_type='brain_document'
order by created_at desc
limit 50;
```

```sql
-- 4) chunk counts for brain_document ai_documents
select d.id as ai_document_id, count(c.id) as chunk_count
from public.ai_documents d
join public.ai_document_chunks c on c.document_id = d.id
where d.doc_type='brain_document'
group by d.id
order by chunk_count desc;
```

```sql
-- 5) embedding counts for brain_document ai_documents
select d.id as ai_document_id, count(e.id) as embedding_count
from public.ai_documents d
join public.ai_embeddings e on e.document_id = d.id
where d.doc_type='brain_document'
group by d.id
order by embedding_count desc;
```

#### Usage logs: seed/repair stages (last 10)
```sql
select created_at, endpoint, model, tokens_in, tokens_out, latency_ms, unknown, metadata
from public.ai_usage_logs
where endpoint in ('ai-seed-default-brain-pack','ai-seed-default-brain-pack-admin')
order by created_at desc
limit 10;
```

#### Privilege verification (critical for cross-tenant)
```sql
-- Verify who can execute the *current signature* of match_ai_embeddings (adjust vector dim if needed).
select
  has_function_privilege('anon', 'public.match_ai_embeddings(uuid, vector(1536), uuid, int, text[], text[], float8)', 'execute') as anon_exec,
  has_function_privilege('authenticated', 'public.match_ai_embeddings(uuid, vector(1536), uuid, int, text[], text[], float8)', 'execute') as auth_exec,
  has_function_privilege('service_role', 'public.match_ai_embeddings(uuid, vector(1536), uuid, int, text[], text[], float8)', 'execute') as service_exec;
```

