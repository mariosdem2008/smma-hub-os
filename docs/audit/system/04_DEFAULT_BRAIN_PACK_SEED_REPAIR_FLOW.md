# 04 — Default Brain Pack v1: Seed/Repair Flow (End-to-End, Current Truth)

## Glossary (shared terms)
- **Default Brain Pack v1**: the system that creates 3 core `brain_documents` (`bootstrap`, `rep_policy`, `quality_bar`) and ingests them into RAG (evidence: `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:32`, `supabase/functions/_shared/seed-default-brain-pack.ts:114`).
- **Seed**: create the 3 docs only when agency has **zero** `brain_documents` total (enforced in RPC) (evidence: `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:58`).
- **Repair**: create only missing defaults if they do not already exist (status <> archived) (enforced in RPC) (evidence: `supabase/migrations/20260116210000_repair_default_brain_pack_v1_rpc.sql:7`).
- **Ingest-only**: re-index the latest approved defaults without creating new docs (shared pipeline behavior) (evidence: `supabase/functions/_shared/seed-default-brain-pack.ts:112`).
- **Ingest into RAG**: create `ai_documents` (`doc_type='brain_document'`) and then chunks + embeddings (evidence: `supabase/functions/_shared/brain-documents.ts:669`).

## Purpose
Document the exact Default Brain Pack v1 pipeline as implemented today: how it is triggered, which RPCs run, what “success” means per stage, what data is created/updated, and what the UI uses as its “truth” for completion and errors.

---

## Data model (tables + key columns + RLS status)
### Tables written/read by this flow
- `public.brain_documents` (insert drafts, later set to approved) (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:39`, `supabase/functions/_shared/brain-documents.ts:345`).
- `public.brain_document_versions` (insert version 1 for each created doc) (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:57`, `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:109`).
- `public.ai_documents` (`doc_type='brain_document'` per module; old row deleted then re-inserted) (evidence: `supabase/functions/_shared/brain-documents.ts:657`, `supabase/functions/_shared/brain-documents.ts:669`).
- `public.ai_document_chunks` + `public.ai_embeddings` (chunking + embedding persistence) (evidence: `supabase/functions/_shared/brain-documents.ts:697`, `supabase/functions/_shared/embedding-store.ts:27`).
- `public.ai_usage_logs` (seed/repair pipeline stages logged) (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:84`).

### RLS notes (what can block the flow)
- Browser/UI uses anon/authenticated keys and is subject to RLS for `brain_documents` reads and for any direct inserts/updates (evidence: `src/hooks/useBrainDocuments.ts:24`).
- Edge functions run with service role key and bypass RLS, but still enforce membership/role in code (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:39`, `supabase/functions/ai-seed-default-brain-pack/index.ts:77`).

---

## UI entry points (routes + components)
### Manual trigger: “Quick Setup” banner
- `/agency/ai-setup` shows `QuickSetupBanner` when core modules not complete (evidence: `src/pages/agency/AISetup.tsx:127`).
- Click triggers `ai-seed-default-brain-pack` with `mode='seed_or_repair'` (evidence: `src/components/ai-setup/QuickSetup/QuickSetupBanner.tsx:31`).

### Automatic trigger: agency creation wizard
- The agency onboarding wizard triggers auto-seed in background after finishing and navigating to dashboard (evidence: `src/pages/CreateAgencyStub.tsx:243`, `src/lib/brain/autoSeedDefaultBrainPackV1.ts:34`).
- It calls `ai-seed-default-brain-pack` with `{agency_id}` and retries up to 3 times by default (evidence: `src/lib/brain/autoSeedDefaultBrainPackV1.ts:18`, `src/lib/brain/autoSeedDefaultBrainPackV1.ts:36`).

### Retry trigger: module error state
- ModuleDetail “Retry Processing” calls `ai-seed-default-brain-pack` with `mode='ingest_only'` (evidence: `src/pages/agency/ModuleDetail.tsx:135`).

---

## Backend/API entry points (edge functions + RPCs)
### Edge function: `ai-seed-default-brain-pack`
- Endpoint guard allowlisted (evidence: `supabase/functions/_shared/endpoint-guard.ts:7`).
- Validates user JWT and enforces role owner/admin (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:44`, `supabase/functions/ai-seed-default-brain-pack/index.ts:77`).
- Chooses `rpcMode`:
  - `ingest_only` when requested in body (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:104`).
  - Otherwise decides `seed` vs `repair` based on whether any `brain_documents` exist (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:107`).
- Calls shared pipeline `seedApproveAndIngestDefaultBrainPackV1(...)` (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:116`).
- Writes staged usage logs to `ai_usage_logs` (best-effort) (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:82`).

### Shared pipeline: `seedApproveAndIngestDefaultBrainPackV1(...)`
- Fetches agency (name/website/niche) to render content (evidence: `supabase/functions/_shared/seed-default-brain-pack.ts:78`).
- **Ingest-only path**:
  - Reads approved defaults for modules `bootstrap`, `rep_policy`, `quality_bar` (evidence: `supabase/functions/_shared/seed-default-brain-pack.ts:114`).
  - Ingests each via `ingestBrainDocumentForRag` and returns `ingested_count` + `failed_ids` (evidence: `supabase/functions/_shared/seed-default-brain-pack.ts:140`, `supabase/functions/_shared/seed-default-brain-pack.ts:153`).
- **Seed/repair path**:
  - Determines `rpcMode` “seed” vs “repair” by checking existence of any brain docs (evidence: `supabase/functions/_shared/seed-default-brain-pack.ts:169`, `supabase/functions/_shared/seed-default-brain-pack.ts:190`).
  - Calls RPC:
    - `seed_default_brain_pack_v1(p_agency_id, p_user_id, p_docs)` (evidence: `supabase/functions/_shared/seed-default-brain-pack.ts:199`).
    - `repair_default_brain_pack_v1(p_agency_id, p_user_id, p_docs)` (evidence: `supabase/functions/_shared/seed-default-brain-pack.ts:226`).
  - For each inserted document id:
    1) Approve doc (archives prior approved per module) (evidence: `supabase/functions/_shared/seed-default-brain-pack.ts:268`).
    2) Ingest doc into RAG (ai_documents/chunks/embeddings) (evidence: `supabase/functions/_shared/seed-default-brain-pack.ts:270`).

### DB RPC: `public.seed_default_brain_pack_v1(...)`
- Atomic + idempotent:
  - advisory lock per agency (evidence: `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:37`).
  - only seeds when agency has 0 `brain_documents` total (evidence: `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:59`).
- Enforces caller identity and role:
  - `auth.uid()` must match `p_user_id` when present (evidence: `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:40`).
  - admin/owner membership required (evidence: `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:48`).
- Requires payload of exactly 3 docs (evidence: `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:32`).

### DB RPC: `public.repair_default_brain_pack_v1(...)`
- Atomic + idempotent:
  - advisory lock per agency (evidence: `supabase/migrations/20260116210000_repair_default_brain_pack_v1_rpc.sql:41`).
  - inserts only missing modules that don’t already exist (status <> archived) (evidence: `supabase/migrations/20260116210000_repair_default_brain_pack_v1_rpc.sql:65`).
- Enforces caller identity and role owner/admin (evidence: `supabase/migrations/20260116210000_repair_default_brain_pack_v1_rpc.sql:51`).

---

## Control flow diagram (seed/repair pipeline)
### Seed/repair (from UI Quick Setup)
Step 1 → UI calls `ai-seed-default-brain-pack` (evidence: `src/components/ai-setup/QuickSetup/QuickSetupBanner.tsx:31`).
Step 2 → Edge validates user and role (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:44`, `supabase/functions/ai-seed-default-brain-pack/index.ts:77`).
Step 3 → Edge chooses seed vs repair (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:107`).
Step 4 → Shared pipeline renders docs and calls seed/repair RPC (evidence: `supabase/functions/_shared/seed-default-brain-pack.ts:98`, `supabase/functions/_shared/seed-default-brain-pack.ts:199`).
Step 5 → RPC inserts `brain_documents` (draft) + `brain_document_versions` version 1 (evidence: `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:86`, `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:109`).
Step 6 → Shared pipeline approves each inserted doc (evidence: `supabase/functions/_shared/seed-default-brain-pack.ts:268`).
Step 7 → Shared pipeline ingests each approved doc into RAG (evidence: `supabase/functions/_shared/seed-default-brain-pack.ts:270`).
Step 8 → Edge writes `ai_usage_logs` stages (best-effort) and returns `{document_ids, failed_ids, ingested_count}` (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:82`, `src/hooks/useSeedDefaultBrainPack.ts:4`).

### Ingest-only retry (from ModuleDetail error state)
Step 1 → User clicks “Retry Processing” → `ai-seed-default-brain-pack` with `mode='ingest_only'` (evidence: `src/pages/agency/ModuleDetail.tsx:135`).
Step 2 → Shared pipeline fetches the latest approved defaults and re-runs ingest for each doc (evidence: `supabase/functions/_shared/seed-default-brain-pack.ts:115`, `supabase/functions/_shared/seed-default-brain-pack.ts:143`).

---

## Truth table of “status” per stage (what exists and what UI shows)
This table documents what the system uses as “truth” today.

### Stage 0 — Not started
- DB: no `brain_documents` row for module (evidence: `src/lib/brain/statusTypes.ts:44`).
- UI: Module status = `not-started` (evidence: `src/lib/brain/statusTypes.ts:44`).

### Stage 1 — Draft created (seed/repair inserted, not yet approved)
- DB:
  - `brain_documents.status='draft'`, `brain_document_versions` exists (evidence: `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:101`, `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:109`).
- UI:
  - module shows “Draft” (evidence: `src/lib/brain/statusTypes.ts:50`).

### Stage 2 — Approved (“active” candidate)
- DB:
  - `brain_documents.status='approved'` and `approved_at` set (evidence: `supabase/functions/_shared/brain-documents.ts:345`).
  - Unique “only one approved per module per agency” enforced by partial index (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:74`).
- UI:
  - module shows “Active” unless ingestion health indicates this approved module is missing from RAG (evidence: `src/lib/brain/statusTypes.ts:46`, `src/pages/agency/AISetup.tsx:63`).

### Stage 3 — Ingested into RAG (AI can retrieve it)
- DB:
  - `ai_documents` row exists for `doc_type='brain_document'` and `metadata.module` matches module (evidence: `supabase/functions/_shared/brain-documents.ts:669`, `supabase/functions/_shared/brain-documents.ts:675`).
  - chunks exist in `ai_document_chunks`, and embeddings in `ai_embeddings` (evidence: `supabase/functions/_shared/brain-documents.ts:697`, `supabase/functions/_shared/embedding-store.ts:27`).
- UI:
  - Ingestion health checks presence of `ai_documents` for approved modules passed by the UI and surfaces missing module as “Needs Attention” (evidence: `supabase/functions/ai-default-brain-pack-ingestion-health/index.ts:74`, `src/lib/brain/statusTypes.ts:47`).

### Stage 4 — Ingest failure (approved but not retrievable)
- DB:
  - Possible states:
    - ai_document exists but many chunks have `embedding_status='failed'`, which retrieval filters out (evidence: `supabase/functions/_shared/embedding-store.ts:23`, `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:46`).
    - Or ai_document missing entirely for a module (evidence: `supabase/functions/ai-default-brain-pack-ingestion-health/index.ts:101`).
- UI:
  - Core modules: status becomes `error` (Needs Attention) (evidence: `src/lib/brain/statusTypes.ts:47`).
  - Non-core modules: **no ingestion health check is performed**, so status may remain “Active” even if embeddings failed (evidence: `src/hooks/useDefaultBrainPackIngestionHealth.ts:5`).

---

## AI behavior (RAG? chunking? embeddings?) — YES/NO/UNKNOWN
- **Chunking**: YES.
  - brain-doc ingestion uses whitespace tokenization and fixed chunk sizes (evidence: `supabase/functions/_shared/embeddings.ts:17`, `supabase/functions/_shared/brain-documents.ts:651`).
- **Embeddings**: YES, uses model default `"text-embedding-3-small"` unless overridden via env (evidence: `supabase/functions/_shared/brain-documents.ts:642`).
- **Retrieval for strategy generation uses these docs**: YES, via `doc_type='brain_document'` matches in `ai-strategy-generate` (evidence: `supabase/functions/ai-strategy-generate/index.ts:271`).

---

## Cross-tenant risks + isolation points
- Isolation: `ai-seed-default-brain-pack` requires membership and owner/admin role for the agency (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:72`, `supabase/functions/ai-seed-default-brain-pack/index.ts:77`).
- Risk: shared pipeline and ingest use a service-role Supabase client; correctness depends on always scoping deletes/inserts to `agency_id` and module (evidence: `supabase/functions/_shared/brain-documents.ts:657`).

---

## Explicit answers required by the mission
### Q9) Does Agency AI Setup impact client strategy generation? Where exactly?
- **YES**, when Default Brain Pack modules are ingested and retrieved as `brain_document` chunks.
- Strategy generation includes `brain_document` in agency doc_types and later builds references from retrieved `ai_documents` rows (evidence: `supabase/functions/ai-strategy-generate/index.ts:271`, `supabase/functions/ai-strategy-generate/index.ts:355`).

### Q10) Are Agency Brain docs embedded and used as RAG? Which tables store chunks/embeddings?
- **YES** for module docs once ingested:
  - `ai_documents` stores the ingested doc (`doc_type='brain_document'`) (evidence: `supabase/functions/_shared/brain-documents.ts:669`).
  - `ai_document_chunks` stores chunk rows and `embedding_status` (evidence: `supabase/functions/_shared/brain-documents.ts:697`).
  - `ai_embeddings` stores vectors (evidence: `supabase/functions/_shared/embedding-store.ts:27`).

### Q11) What is the end goal, and where does current code diverge?
- **End goal (implied)**: “safe defaults for all core AI settings” and “AI can use this content” (evidence: `src/components/ai-setup/QuickSetup/QuickSetupBanner.tsx:57`, `src/pages/agency/ModuleDetail.tsx:231`).
- **Divergence**: ingestion health error detection is implemented only for 3 core modules; other module ingestion failures are not surfaced by the same health check (evidence: `src/hooks/useDefaultBrainPackIngestionHealth.ts:5`).

---

## Failure modes (top 5) + how they surface
1) **Forbidden role (non-admin)** → 403 response if a non-admin forces the call; UI should disable Quick Setup when `canEditContent=false` (evidence: `src/hooks/useRole.ts:75`, `supabase/functions/ai-seed-default-brain-pack/index.ts:77`).
2) **RPC seed disallowed by idempotency** (agency already has any brain_documents) → seed RPC returns no rows; edge switches to repair in “seed_or_repair” mode, but direct `seed` mode would no-op (evidence: `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:59`, `supabase/functions/_shared/seed-default-brain-pack.ts:190`).
3) **Embedding API missing** → chunk embeddings fail; retrieval later returns fewer/no matches (evidence: `supabase/functions/_shared/embedding-policy.ts:17`, `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:46`).
4) **Partial ingestion failure** → response includes `failed_ids`; Quick Setup banner tells user to “Retry processing” inside module (evidence: `src/components/ai-setup/QuickSetup/QuickSetupBanner.tsx:32`).
5) **`ai_usage_logs` insert failure** is swallowed and does not block the response (observability gap) (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:99`).

---

## Verification checklist (commands + SQL)
### Repo commands (required by request)
- `npm test`
- `npm run lint`
- `npx tsc -p tsconfig.json --noEmit`
- `npm run build`

### SQL checks (prove each stage)
```sql
-- A) What does the agency have in brain_documents?
select module, status, approved_at, approved_by, version, updated_at
from public.brain_documents
where agency_id = :agency_id
and module in ('bootstrap','rep_policy','quality_bar')
order by module;
```

```sql
-- B) Are the 3 docs ingested to ai_documents as brain_document?
select id, metadata
from public.ai_documents
where agency_id = :agency_id
and doc_type = 'brain_document'
and (metadata->>'module') in ('bootstrap','rep_policy','quality_bar')
order by created_at desc;
```

```sql
-- C) Do those ai_documents have chunks + embeddings?
select d.id as ai_document_id,
       count(distinct c.id) as chunks,
       count(distinct e.id) as embeddings,
       sum(case when c.embedding_status='failed' then 1 else 0 end) as failed_chunks
from public.ai_documents d
left join public.ai_document_chunks c on c.document_id = d.id
left join public.ai_embeddings e on e.document_id = d.id
where d.agency_id = :agency_id
and d.doc_type = 'brain_document'
group by d.id
order by d.id;
```

```sql
-- D) Usage logs for the pipeline
select created_at, endpoint, model, unknown, metadata
from public.ai_usage_logs
where agency_id = :agency_id
and endpoint in ('ai-seed-default-brain-pack','ai-seed-default-brain-pack-admin')
order by created_at desc
limit 20;
```

---

## “Source of truth” (Default Brain Pack v1 pipeline status)
This pipeline has multiple partial truths depending on what you’re trying to answer:

### “Are the docs created?”
- Source of truth: `brain_documents` rows exist for the agency and module keys (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:39`).

### “Are they approved?”
- Source of truth: `brain_documents.status='approved'` and `approved_at is not null` (evidence: `src/lib/brain/statusTypes.ts:46`).

### “Can retrieval use them?”
- Source of truth: `ai_documents` rows exist with `doc_type='brain_document'` and `metadata->>module` (evidence: `supabase/functions/ai-default-brain-pack-ingestion-health/index.ts:83`).

### “What happened most recently?”
- Source of truth: `ai_usage_logs.metadata->>'stage'` values emitted by the seed endpoint (evidence: `supabase/functions/_shared/default-brain-pack-usage-log.ts:2`, `supabase/functions/_shared/default-brain-pack-usage-log.ts:38`).

---

## Pipeline stage vocabulary (as logged today)
- Stages: `seed_rpc_called`, `repair_rpc_called`, `approved`, `ingested`, `completed`, `failed` (evidence: `supabase/functions/_shared/default-brain-pack-usage-log.ts:2`).
- Logs include `endpoint="ai-seed-default-brain-pack"` and `model="default_brain_pack_v1"` (evidence: `supabase/functions/_shared/default-brain-pack-usage-log.ts:38`, `supabase/functions/_shared/default-brain-pack-usage-log.ts:39`).

### Verification SQL (stage-only view)
```sql
select created_at,
       metadata->>'stage' as stage,
       (metadata->>'inserted_count')::int as inserted_count,
       (metadata->>'ingested_count')::int as ingested_count,
       metadata->'failed_ids' as failed_ids
from public.ai_usage_logs
where agency_id = :agency_id
and endpoint in ('ai-seed-default-brain-pack','ai-seed-default-brain-pack-admin')
order by created_at desc
limit 50;
```
