# Default Brain Pack v1 — Action Plan (Prioritized)

## Status Summary

- **DONE:** Default Brain Pack templates exist and are shared frontend/edge: `supabase/functions/_shared/defaultBrainPackV1.ts:97` and `src/brain/defaultPackV1.ts:1`.
- **DONE:** Seed/repair/ingest-only flow exists and sequences RPC → approve → ingest: `supabase/functions/_shared/seed-default-brain-pack.ts:1`.
- **DONE:** Ingestion delete is agency-scoped (prevents cross-tenant deletes): `supabase/functions/_shared/brain-documents.ts:657`.
- **DONE:** Approve edge enforces admin/owner role (service role protected): `supabase/functions/_shared/ai-brain-document-approve-handler.ts:55`.
- **DONE:** UI CTA gating uses “missing default modules” (not total count): `src/pages/agency/BrainLayerDetail.tsx:107`.
- **DONE:** Repair RPC exists for partial agencies: `supabase/migrations/20260116210000_repair_default_brain_pack_v1_rpc.sql:8`.
- **DONE:** Ingestion Health banner + Retry ingest exist: `src/pages/agency/BrainLayerDetail.tsx:415`.
- **DONE:** Stage-structured logging to `ai_usage_logs.metadata.stage`: `supabase/functions/_shared/default-brain-pack-usage-log.ts:47`.
- **DONE:** Strategy outputs include deterministic brain_document References + `rag_debug`: `supabase/functions/ai-strategy-generate/index.ts:370` and `supabase/functions/ai-strategy-generate/index.ts:627`.
- **DONE:** Quarantined unused demo route `/ai/field-demo`: `src/pages/ai/AiFieldDemo.tsx:1`.

## Tasks (15–30, with Priority/Risk/Owner/Targets/Verification)

1) P0 / Risk 5 / Backend: Scope `ai_documents` delete by `agency_id` (and ideally by `brain_document_id`)  
   - Target: `supabase/functions/_shared/brain-documents.ts:657`  
   - Verify: create two agencies; ingest bootstrap for one; ensure other’s `ai_documents` remain.

2) P0 / Risk 5 / Backend: Decide approval authorization model (member vs admin/owner) and enforce it  
   - Target: `supabase/functions/_shared/ai-brain-document-approve-handler.ts:55`  
   - Verify: member with role != admin attempts approval; expect 403 if admin-only.

3) P0 / Risk 4 / Backend: Confirm `service_role` can execute `seed_default_brain_pack_v1` in DB  
   - Target: `supabase/migrations/20260116193000_seed_default_brain_pack_v1_grant_service_role.sql:1`  
   - Verify SQL: `select has_function_privilege('service_role','public.seed_default_brain_pack_v1(uuid, uuid, jsonb)','execute');`

4) P0 / Risk 4 / Frontend: Fix “Create Default Brain Pack” gating to detect missing modules, not total count  
   - Target: `src/pages/agency/BrainLayerDetail.tsx:107`  
   - Verify: agency with 1 non-default doc still sees CTA or a “repair defaults” CTA.

5) P1 / Risk 4 / Backend: Add a “repair defaults” RPC that inserts missing default modules if absent  
   - Target: `supabase/migrations/20260116210000_repair_default_brain_pack_v1_rpc.sql:8`  
   - Verify: agency with partial set gets missing 1–3 docs inserted; no duplicates (safe repeated calls).

6) P1 / Risk 3 / Frontend: Surface ingestion health + retry ingest  
   - Targets: `src/pages/agency/BrainLayerDetail.tsx:415` and `src/hooks/useDefaultBrainPackIngestionHealth.ts:7`  
   - Verify: delete `ai_documents` rows for one default module; banner appears and retry fixes it.

7) P1 / Risk 3 / Backend: Add structured “seed result” logging with agency/user + error stages  
   - Targets: `supabase/functions/ai-seed-default-brain-pack/index.ts:82` and `supabase/functions/_shared/default-brain-pack-usage-log.ts:9`  
   - Verify: `ai_usage_logs.metadata->>'stage'` shows `{seed_rpc_called|repair_rpc_called|approved|ingested|completed|failed}`.

8) P1 / Risk 3 / Backend: Add citation metadata into strategy prompt context (module/title/source_url)  
   - Target: `supabase/functions/ai-strategy-generate/index.ts:332`  
   - Verify: output contains a references section mapping chunks to module/doc.

9) P1 / Risk 3 / Backend: Ensure ingestion sets `metadata.status` from live status and update on re-approve  
   - Target: `supabase/functions/_shared/brain-documents.ts:673`  
   - Verify: re-approving a new version updates metadata and retrieval includes only latest.

10) P2 / Risk 2 / Docs: Rename UI copy to distinguish “Agency Brain (modules)” vs “Agency Brain JSON”  
   - Target: `src/pages/agency/AgencyBrain.tsx:78` and strategy prompt labels `src/ai/prompts/strategyPlan.ts:16`  
   - Verify: UX copy reduces confusion.

11) P2 / Risk 2 / Backend: Reduce migration ambiguity by deleting/quarantining one duplicate brain_documents migration  
   - Targets: `supabase/migrations/20251228120000_brain_documents_and_calibration_state.sql:1` and `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:1`  
   - Verify: only one canonical file remains; migration history documented.

12) P2 / Risk 2 / Ops: Ensure `CRON_SECRET` rotation and log redaction rules for backfill scripts  
   - Targets: `supabase/functions/_shared/cron.ts:5` and `scripts/backfill-default-brain-pack.mjs:24`  
   - Verify: secrets never printed, rotated via env management.

## Definition of Done (PASS/FAIL checks)

Run these SQL checks per agency after seeding:

1) `brain_documents` seeded count (PASS: 3)  
   - Query basis: `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:32`

2) `brain_documents` approved count (PASS: 3)  
   - Evidence approval exists: `supabase/functions/_shared/brain-documents.ts:346`

3) `ai_documents` brain_document per module (PASS: 3; scoped to agency)  
   - Evidence insert: `supabase/functions/_shared/brain-documents.ts:663`

4) `ai_document_chunks.embedding_status='ok'` > 0 (PASS)  
   - Evidence status write: `supabase/functions/_shared/embedding-store.ts:35`

5) Retrieval returns at least 1 `brain_document` row (PASS)  
   - Evidence retrieval call: `supabase/functions/ai-strategy-generate/index.ts:283`

## Verification (P0 + Operational)

### Commands (2026-01-16)

- `npm test` → PASS (76 test files, 407 tests)
- `npm run lint` → PASS
- `npx tsc -p tsconfig.json --noEmit` → PASS
- `npm run build` → PASS (Browserslist data warning only)

### Runtime checks (repair + ingest health)

1) Partial agency repair (EXPECT: inserts missing defaults only)

- Create a non-default doc (e.g. `tone_voice`) so agency has >0 docs but missing defaults.
- Click “Create/Repair Default Brain Pack” (`src/pages/agency/BrainLayerDetail.tsx:455`).
- Verify only missing modules were inserted via SQL query (below: defaults present = 3).

2) Ingestion Health banner + retry (EXPECT: banner appears then clears)

- Manually delete one default module’s `ai_documents` row for your agency.
- Load any Agency Brain layer; banner should appear (`src/pages/agency/BrainLayerDetail.tsx:415`).
- Click “Retry ingest”; banner should disappear after refresh.

### SQL (copy/paste; replace `'YOUR_AGENCY_ID'`)

1) Defaults present in `brain_documents` (EXPECT: `3`)

```sql
select count(distinct module) as default_modules_present
from brain_documents
where agency_id = 'YOUR_AGENCY_ID'
  and status <> 'archived'
  and module in ('bootstrap','rep_policy','quality_bar');
```

2) Approved defaults count (EXPECT: `3`)

```sql
select count(*) as approved_defaults
from brain_documents
where agency_id = 'YOUR_AGENCY_ID'
  and status <> 'archived'
  and status = 'approved'
  and module in ('bootstrap','rep_policy','quality_bar');
```

3) `ai_documents` count for default brain docs (EXPECT: `3`)

```sql
select count(*) as ai_documents_default_brain_docs
from ai_documents
where agency_id = 'YOUR_AGENCY_ID'
  and doc_type = 'brain_document'
  and (metadata->>'module') in ('bootstrap','rep_policy','quality_bar');
```

4) Embeddings count for default brain docs (EXPECT: `> 0`)

```sql
select count(*) as ai_embeddings_default_brain_docs
from ai_embeddings e
join ai_document_chunks c on c.id = e.chunk_id
join ai_documents d on d.id = c.document_id
where d.agency_id = 'YOUR_AGENCY_ID'
  and d.doc_type = 'brain_document'
  and (d.metadata->>'module') in ('bootstrap','rep_policy','quality_bar');
```

## Definition of Done (ship-ready)

### SQL (6 queries; expected numeric results)

Replace `'YOUR_AGENCY_ID'` and `'YOUR_CLIENT_ID'`.

1) Defaults present in `brain_documents` (EXPECT: `3`)

```sql
select count(distinct module) as default_modules_present
from brain_documents
where agency_id = 'YOUR_AGENCY_ID'
  and status <> 'archived'
  and module in ('bootstrap','rep_policy','quality_bar');
```

2) Approved defaults count (EXPECT: `3`)

```sql
select count(*) as approved_defaults
from brain_documents
where agency_id = 'YOUR_AGENCY_ID'
  and status = 'approved'
  and module in ('bootstrap','rep_policy','quality_bar');
```

3) Default brain docs in `ai_documents` (EXPECT: `3`)

```sql
select count(*) as ai_documents_default_brain_docs
from ai_documents
where agency_id = 'YOUR_AGENCY_ID'
  and doc_type = 'brain_document'
  and (metadata->>'module') in ('bootstrap','rep_policy','quality_bar');
```

4) Embeddings for default brain docs (EXPECT: `> 0`)

```sql
select count(*) as ai_embeddings_default_brain_docs
from ai_embeddings e
join ai_document_chunks c on c.id = e.chunk_id
join ai_documents d on d.id = c.document_id
where d.agency_id = 'YOUR_AGENCY_ID'
  and d.doc_type = 'brain_document'
  and (d.metadata->>'module') in ('bootstrap','rep_policy','quality_bar');
```

5) Failed chunks for default brain docs (EXPECT: `0` in healthy state)

```sql
select count(*) as failed_chunks_default_brain_docs
from ai_document_chunks c
join ai_documents d on d.id = c.document_id
where d.agency_id = 'YOUR_AGENCY_ID'
  and d.doc_type = 'brain_document'
  and (d.metadata->>'module') in ('bootstrap','rep_policy','quality_bar')
  and c.embedding_status = 'failed';
```

6) Completed seed/repair runs logged (EXPECT: `>= 1` after you click CTA at least once)

```sql
select count(*) as completed_default_pack_ops
from ai_usage_logs
where agency_id = 'YOUR_AGENCY_ID'
  and endpoint = 'ai-seed-default-brain-pack'
  and metadata->>'stage' = 'completed';
```

### UI Steps (5)

1) Agency with missing defaults: go to `Agency Brain` → any empty layer, click “Create/Repair Default Brain Pack” (`src/pages/agency/BrainLayerDetail.tsx:455`).
2) Reload: verify the 3 default modules exist and show configured.
3) Simulate missing RAG by deleting one default `ai_documents` row; confirm banner shows “Retry ingest” (`src/pages/agency/BrainLayerDetail.tsx:415`).
4) Click “Retry ingest”; banner disappears after refresh and query invalidation.
5) Generate a strategy; confirm the response includes `rag_debug.brain_document_references_used` with module/title/brain_document_id/version (`supabase/functions/ai-strategy-generate/index.ts:627`).

### Failure Modes (3) + What to do

1) **Missing embeddings configuration** (no RAG usage)
   - Symptom: ingestion fails or chunks remain `embedding_status='failed'` and banner persists.
   - Action: configure embedding API key and retry ingest (`mode=ingest_only`).

2) **Role forbidden (admin/owner required)**
   - Symptom: CTA click returns 403 `FORBIDDEN_ROLE`.
   - Action: ensure user is `agency_members.role in ('owner','admin')`, then retry.

3) **Partial ingest failures (provider or dimension issues)**
   - Symptom: seed/repair returns `failed_ids` and `ai_usage_logs.metadata.stage='failed'`.
   - Action: check `ai_document_chunks.embedding_status`, fix provider/dimension, then retry ingest.
