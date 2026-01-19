# 00 — SUMMARY STORY: Default Brain Pack v1 (Current Truth)

## Glossary (shared terms)
- **Agency AI Setup modules**: modular docs stored in `public.brain_documents` / `public.brain_document_versions` and edited/approved in `/agency/ai-setup` (evidence: `src/App.tsx:267`, `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:39`).
- **Default Brain Pack v1**: the “seed/repair” pipeline that creates and ingests core Agency AI Setup modules (`bootstrap`, `rep_policy`, `quality_bar`) (evidence: `src/pages/agency/AISetup.tsx:30`, `supabase/functions/_shared/seed-default-brain-pack.ts:199`).
- **Seed vs repair**: seed RPC inserts defaults only when the agency has **zero** `brain_documents`; repair inserts only missing defaults (evidence: `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:59`, `supabase/functions/_shared/seed-default-brain-pack.ts:226`).
- **Ingest (RAG)**: turning approved module text into `ai_documents` + `ai_document_chunks` + `ai_embeddings` so retrieval can use it later (evidence: `supabase/functions/_shared/brain-documents.ts:650`, `supabase/functions/_shared/embedding-store.ts:27`).
- **Agency Brain (JSON)**: separate monolithic structure stored in `public.agency_brains.brain_json` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:7`).
- **Client Brain (JSON)**: client monolithic structure stored in `public.client_brains.brain_json` and gated by `client_brains.usable` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:20`, `supabase/functions/ai-strategy-generate/index.ts:170`).
- **Retrieval**: RPC `public.match_ai_embeddings(...)` returning chunks by `agency_id`/`client_id` filters (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:11`, `supabase/functions/ai-strategy-generate/index.ts:274`).

## Purpose
Narrate the system end-to-end as it behaves today: agency creation, auto-seeding defaults, ingestion/chunking/embeddings, module review/approve, how strategy generation uses (or does not use) those docs, and where UI expectations diverge from implemented behavior.

---

## Data model (tables + key columns + RLS status)
### Modular Agency AI Setup docs (Default Brain Pack v1 targets)
- `public.brain_documents` key columns include `agency_id`, `module`, `status`, `approved_at`, `approved_by`, `version` (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:39`).
- `public.brain_document_versions` key columns include `document_id`, `version`, `content_markdown`, `source` (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:57`).
- RLS status: enabled for both tables (policy details are in migrations; verify in DB) (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:93`, `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:142`).

### RAG storage (used by strategy generation + admin chat)
- `public.ai_documents` stores ingested docs including `doc_type='brain_document'` for module docs (evidence: `supabase/migrations/20260108123000_brain_documents_rag.sql:16`).
- `public.ai_document_chunks` stores chunk rows and `embedding_status` (evidence: `supabase/migrations/20260105140000_embedding_chunk_status.sql:3`).
- `public.ai_embeddings` stores vectors (schema declares `vector(1536)`) (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:78`).
- `public.ai_usage_logs` stores per-endpoint logs with freeform `metadata` (evidence: `supabase/migrations/20251224090000_brain_spine_v1.sql:32`).

### Monolithic brains (separate from modular docs)
- `public.agency_brains` stores `brain_json` and later `calibration_state` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:7`, `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:407`).
- `public.client_brains` stores `brain_json`, `usable`, `status` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:20`, `supabase/migrations/20251224090000_brain_spine_v1.sql:3`).

### Strategy OS outputs
- `public.strategy_documents`, `public.strategy_modules`, `public.strategies` written via `public.create_strategy_snapshot(...)` (evidence: `supabase/migrations/20260108143000_strategy_snapshot_rpc.sql:3`).

---

## UI entry points (routes + components)
- Agency creation wizard: `/create-agency` (evidence: `src/App.tsx:242`).
- Agency AI Setup list: `/agency/ai-setup` (evidence: `src/App.tsx:267`).
- Module detail: `/agency/ai-setup/:moduleKey` (evidence: `src/App.tsx:268`).
- Guided onboarding chat: `/ai/admin` (evidence: `src/App.tsx:273`).
- Client onboarding: `/onboarding/client/:clientId` (evidence: `src/App.tsx:276`).

---

## Backend/API entry points (edge functions + RPCs)
- Edge: `ai-seed-default-brain-pack` (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:18`).
- RPC seed: `public.seed_default_brain_pack_v1(...)` (evidence: `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:7`).
- RPC repair: `public.repair_default_brain_pack_v1(...)` (evidence: `supabase/migrations/20260116210000_repair_default_brain_pack_v1_rpc.sql:8`).
- RPC create agency: `public.create_agency_with_admin(text, text)` (evidence: `supabase/migrations/20251225210000_agency_onboarding_and_create_agency_rpc.sql:61`).
- Edge: `ai-brain-ingest` (agency + client scope) (evidence: `src/pages/CreateAgencyStub.tsx:229`, `supabase/functions/ai-brain-ingest/index.ts:310`).
- Edge: `ai-strategy-generate` (evidence: `supabase/functions/ai-strategy-generate/index.ts:97`).
- Retrieval RPC: `public.match_ai_embeddings(...)` (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:11`).

---

## Control flow diagram (the story) in text
### Act 1 — Agency created, then auto-seed defaults is attempted
Step 1 -> User visits `/create-agency` and completes the static onboarding wizard (evidence: `src/App.tsx:242`).

Step 2 -> Wizard creates the agency using `create_agency_with_admin(...)` (evidence: `supabase/migrations/20251225210000_agency_onboarding_and_create_agency_rpc.sql:61`).

Step 3 -> Wizard updates + locks the monolithic Agency Brain JSON using `ai-brains-agency` (evidence: `src/pages/CreateAgencyStub.tsx:217`, `src/pages/CreateAgencyStub.tsx:224`).

Step 4 -> Wizard calls `ai-brain-ingest scope='agency'` and provides `raw_responses` (the answers) (evidence: `src/pages/CreateAgencyStub.tsx:229`).

Step 5 -> Wizard triggers Default Brain Pack v1 auto-seed in background (`autoSeedDefaultBrainPackV1InBackground`) after ingestion finishes (evidence: `src/pages/CreateAgencyStub.tsx:243`).

Step 6 -> Auto-seed calls `ai-seed-default-brain-pack` with `{agency_id}` and retries up to 3 attempts (evidence: `src/lib/brain/autoSeedDefaultBrainPackV1.ts:18`, `src/lib/brain/autoSeedDefaultBrainPackV1.ts:36`).

Step 7 -> If auto-seed fails, user sees toast “Defaults can be created later” (evidence: `src/pages/CreateAgencyStub.tsx:247`).

### Act 2 — Agency AI Setup page offers “Quick Setup” seeding as a user action
Step 8 -> User visits `/agency/ai-setup` which loads `brain_documents` and shows module cards (evidence: `src/App.tsx:267`, `src/hooks/useBrainDocuments.ts:24`).

Step 9 -> If core modules aren’t complete, “Quick Setup” appears and calls `ai-seed-default-brain-pack` with `mode="seed_or_repair"` (evidence: `src/pages/agency/AISetup.tsx:127`, `src/components/ai-setup/QuickSetup/QuickSetupBanner.tsx:31`).

Step 10 -> Module uploads invoke `ai-brain-analyze`, but that endpoint returns placeholder output (analysis mismatch) (evidence: `supabase/functions/ai-brain-analyze/index.ts:126`).

### Act 3 — Seed/repair backend selects RPC, then approves + ingests
Step 11 -> `ai-seed-default-brain-pack` checks membership and restricts to admin/owner (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:72`, `supabase/functions/ai-seed-default-brain-pack/index.ts:77`).

Step 12 -> Shared seeding logic calls either `seed_default_brain_pack_v1` or `repair_default_brain_pack_v1` depending on mode and idempotency (evidence: `supabase/functions/_shared/seed-default-brain-pack.ts:199`, `supabase/functions/_shared/seed-default-brain-pack.ts:226`).

Step 13 -> Seed idempotency: the seed RPC no-ops if any `brain_documents` already exist for the agency (evidence: `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:59`).

Step 14 -> After inserts, the endpoint approves + ingests docs using shared helpers (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:6`).

Step 15 -> Endpoint logs staged events to `ai_usage_logs` with `endpoint="ai-seed-default-brain-pack"` and staged `metadata->>'stage'` values (evidence: `supabase/functions/_shared/default-brain-pack-usage-log.ts:2`, `supabase/functions/_shared/default-brain-pack-usage-log.ts:38`).

### Act 4 — Ingestion/chunking/embeddings write the RAG tables
Step 16 -> Ingest tokenizes extracted text and builds chunks with `MAX_CHUNKS=120` for brain docs (evidence: `supabase/functions/_shared/brain-documents.ts:83`, `supabase/functions/_shared/brain-documents.ts:651`).

Step 17 -> It writes `ai_documents doc_type='brain_document'` with module metadata (evidence: `supabase/functions/_shared/brain-documents.ts:669`).

Step 18 -> It writes chunks and stores embeddings (vectors) via the embedding store (evidence: `supabase/functions/_shared/brain-documents.ts:697`, `supabase/functions/_shared/embedding-store.ts:27`).

### Act 5 — Strategy generation uses RAG and emits References
Step 19 -> Strategy generation invokes `match_ai_embeddings` for client, agency, and exemplars (evidence: `supabase/functions/ai-strategy-generate/index.ts:274`, `supabase/functions/ai-strategy-generate/index.ts:284`).

Step 20 -> Agency retrieval includes `doc_type='brain_document'`, which is the path by which AI Setup modules influence strategy output (evidence: `supabase/functions/ai-strategy-generate/index.ts:271`, `src/ai/ragPolicy.ts:51`).

Step 21 -> Strategy generation formats a “References:” section from matches + `ai_documents` (evidence: `supabase/functions/ai-strategy-generate/index.ts:364`, `supabase/functions/_shared/strategy-references.ts:100`).

Step 22 -> Output persists via `create_strategy_snapshot(...)` and marks strategy documents active as part of that RPC (evidence: `supabase/migrations/20260108143000_strategy_snapshot_rpc.sql:3`, `supabase/migrations/20260108143000_strategy_snapshot_rpc.sql:62`).

---

## AI behavior (RAG? chunking? embeddings? prompts? retrieval?)
- RAG used for strategy generation: **YES** (evidence: `supabase/functions/ai-strategy-generate/index.ts:274`).
- Agency AI Setup module docs embedded for retrieval: **YES once ingested** to `ai_documents/doc_type='brain_document'` (evidence: `supabase/functions/_shared/brain-documents.ts:669`).
- Chunking algorithm exists and is invoked for module docs: **YES** (evidence: `supabase/functions/_shared/embeddings.ts:21`, `supabase/functions/_shared/brain-documents.ts:651`).

---

## “Source of truth” (what decides status)
- Module status: `brain_documents.status` drives UI states (evidence: `src/lib/brain/statusTypes.ts:43`).
- Core-module ingestion health: existence of `ai_documents` rows for modules (evidence: `supabase/functions/ai-default-brain-pack-ingestion-health/index.ts:83`).
- Client strategy readiness: `client_brains.usable` gate (evidence: `supabase/functions/ai-strategy-generate/index.ts:185`).

---

## Cross-tenant risks + isolation enforcement (high-level)
- Most “service role” functions must enforce membership in code; verify for each function you expose publicly (evidence: `supabase/functions/_shared/env.ts:8`, `supabase/functions/ai-seed-default-brain-pack/index.ts:72`).
- `match_ai_embeddings` EXECUTE privileges are a critical isolation boundary; signature changes can cause privilege drift (UNKNOWN until verified in deployed DB) (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:3`).

---

## Failure modes (top 5) + how they surface
1) Auto-seed fails -> onboarding toast “Defaults can be created later” (evidence: `src/pages/CreateAgencyStub.tsx:247`).
2) Role restriction (owner/admin required) -> 403s on seed/approve endpoints if a non-admin forces a call; UI should keep CTAs disabled for non-admins (evidence: `src/hooks/useRole.ts:75`, `supabase/functions/ai-seed-default-brain-pack/index.ts:77`).
3) Missing `OPENAI_API_KEY` -> strategy generation returns 500 with `code=MISSING_API_KEY` (evidence: `supabase/functions/ai-strategy-generate/index.ts:231`).
4) Ingestion failures -> “Needs attention” shown for approved modules whose RAG ingestion is missing (evidence: `src/hooks/useDefaultBrainPackIngestionHealth.ts:1`, `src/pages/agency/AISetup.tsx:29`).
5) “Analyze upload” is placeholder -> UI analysis expectations diverge (evidence: `supabase/functions/ai-brain-analyze/index.ts:126`).

---

## Explicit answers required by the mission
### Q9) Does Agency AI Setup impact client strategy generation? Where exactly?
- **YES**: after ingestion, strategy retrieval includes `brain_document` doc type for the agency and includes those chunks in prompt context (evidence: `supabase/functions/ai-strategy-generate/index.ts:271`, `supabase/functions/ai-strategy-generate/index.ts:274`).
- **NO direct read of `brain_documents`** in strategy generation; it uses `match_ai_embeddings` over `ai_embeddings` (evidence: `supabase/functions/ai-strategy-generate/index.ts:274`).

### Q10) Are Agency Brain docs embedded and used as RAG? Which tables store chunks/embeddings?
- Modular docs: **YES** once ingested into `ai_documents` + `ai_document_chunks` + `ai_embeddings` (evidence: `supabase/functions/_shared/brain-documents.ts:669`, `supabase/functions/_shared/brain-documents.ts:697`).
- Agency Brain JSON embedded: **UNKNOWN** beyond the “Agency brain summary” artifact; verify by searching for additional `doc_type` usage and ingestion call sites (verification: `rg -n \"Agency brain summary|doc_type.*ai_artifact\" supabase/functions -S`) (evidence: `supabase/functions/ai-brain-ingest/index.ts:221`).

### Q11) What is the end goal, and where does current code diverge?
- End goal implied by UI: approved module content should become usable AI memory (evidence: `src/pages/agency/ModuleDetail.tsx:228`).
- Divergences:
  - Upload analysis endpoint is placeholder (evidence: `supabase/functions/ai-brain-analyze/index.ts:126`).
  - Ingestion health signals cover only 3 core modules (evidence: `src/pages/agency/AISetup.tsx:30`, `src/hooks/useDefaultBrainPackIngestionHealth.ts:5`).

---

## Verification checklist (commands + SQL)
### Repo commands (required by request)
- `npm test`
- `npm run lint`
- `npx tsc -p tsconfig.json --noEmit`
- `npm run build`

### SQL checks (prove the story end-to-end)
```sql
-- A) Brain docs exist and are approved (core modules)
select module, status, approved_at, approved_by, version, updated_at
from public.brain_documents
where agency_id = :agency_id
and module in ('bootstrap','rep_policy','quality_bar')
order by module;
```

```sql
-- B) Those modules are ingested into ai_documents
select id, doc_type, metadata, created_at
from public.ai_documents
where agency_id = :agency_id
and doc_type = 'brain_document'
and (metadata->>'module') in ('bootstrap','rep_policy','quality_bar')
order by created_at desc;
```

```sql
-- C) Chunks + embeddings exist for those ai_documents
select d.id as ai_document_id,
       count(distinct c.id) as chunks,
       count(distinct e.id) as embeddings,
       sum(case when c.embedding_status='failed' then 1 else 0 end) as failed_chunks
from public.ai_documents d
left join public.ai_document_chunks c on c.document_id = d.id
left join public.ai_embeddings e on e.document_id = d.id
where d.agency_id = :agency_id
and d.doc_type = 'brain_document'
and (d.metadata->>'module') in ('bootstrap','rep_policy','quality_bar')
group by d.id
order by d.id;
```

```sql
-- D) Recent Default Brain Pack usage logs
select created_at, endpoint, unknown, metadata
from public.ai_usage_logs
where agency_id = :agency_id
and endpoint in ('ai-seed-default-brain-pack','ai-seed-default-brain-pack-admin')
order by created_at desc
limit 10;
```
