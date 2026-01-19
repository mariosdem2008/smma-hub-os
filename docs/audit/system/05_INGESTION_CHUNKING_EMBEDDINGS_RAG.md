# 05 — Ingestion, Chunking, Embeddings, and RAG (Current Truth)

## Glossary (shared terms)
- **Ingestion (brain doc → RAG)**: converting `brain_documents` into `ai_documents` (`doc_type='brain_document'`) + chunks + embeddings (evidence: `supabase/functions/_shared/brain-documents.ts:618`).
- **Ingestion (brain ingest summaries)**: converting agency/client brain summaries into `ai_documents` (`doc_type='ai_artifact'`) + chunks + embeddings (evidence: `supabase/functions/ai-brain-ingest/index.ts:221`, `supabase/functions/ai-brain-ingest/index.ts:333`).
- **Chunk**: row in `ai_document_chunks` containing `chunk_text` and `token_count` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:61`).
- **Embedding**: row in `ai_embeddings` storing `embedding vector(1536)` per chunk (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:78`).
- **Retrieval**: calling `public.match_ai_embeddings(...)` to return top similar chunks (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:11`).
- **RAG policy**: centralized selection/capping logic in `src/ai/ragPolicy.ts` used by `ai-strategy-generate` when enabled (evidence: `supabase/functions/ai-strategy-generate/index.ts:9`).

## Purpose
Explain how ingestion and retrieval actually work in this repo today, including: where chunking happens, chunk sizes, embedding model/dims, how failures are represented, and exactly where RAG is used (or not used) in downstream tasks like strategy generation.

---

## Data model (tables + key columns + RLS status)
This module touches:
- `ai_documents` (doc metadata/content) (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:34`).
- `ai_document_chunks` (chunk text + embedding_status) (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:61`, `supabase/migrations/20260105140000_embedding_chunk_status.sql:3`).
- `ai_embeddings` (vector store) (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:71`).
- `ai_usage_logs` (used by retrieval + ingest endpoints) (evidence: `supabase/functions/ai-retrieve-context/index.ts:143`, `supabase/functions/ai-brain-ingest/index.ts:416`).
- Input sources vary by pipeline:
  - `brain_documents` (module docs) (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:39`).
  - `agency_brains` / `client_brains` (monolithic brains) (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:7`).

---

## UI entry points (routes + components)
RAG itself is not “a page”, but ingestion/retrieval is triggered by UI actions:
- **Approve module doc** (ingests brain doc to RAG):
  - `/agency/ai-setup/:moduleKey` Activate → `ai-brain-document-approve` (evidence: `src/App.tsx:268`, `src/hooks/useBrainDocuments.ts:256`).
- **Quick Setup** (seed/repair/approve/ingest defaults):
  - `/agency/ai-setup` → QuickSetupBanner → `ai-seed-default-brain-pack` (evidence: `src/pages/agency/AISetup.tsx:127`, `src/components/ai-setup/QuickSetup/QuickSetupBanner.tsx:31`).
- **Retrieve context** (debug or internal usage):
  - Any UI calling `ai-retrieve-context` would hit retrieval, but this audit only confirms backend exists (evidence: `supabase/functions/ai-retrieve-context/index.ts:129`).
- **Strategy generation** (retrieval + AI task):
  - Strategy hooks call `ai-strategy-generate` (evidence: `src/hooks/useStrategyDocuments.ts:67`, `src/hooks/useStrategyModules.ts:268`).

---

## Backend/API entry points (ingestion + retrieval)
### Ingestion: brain documents (`brain_documents` → `ai_documents` doc_type `brain_document`)
- `ingestBrainDocumentForRag(...)` is called by:
  - `ai-brain-document-approve` handler (evidence: `supabase/functions/_shared/ai-brain-document-approve-handler.ts:62`).
  - Default Brain Pack shared pipeline (evidence: `supabase/functions/_shared/seed-default-brain-pack.ts:270`).

### Ingestion: agency/client brain summaries (`agency_brains` / `client_brains` → `ai_documents` doc_type `ai_artifact`)
- `ai-brain-ingest` writes “Agency brain summary” and “Client brain summary” to `ai_documents` and embeds them (evidence: `supabase/functions/ai-brain-ingest/index.ts:221`, `supabase/functions/ai-brain-ingest/index.ts:333`).

### Retrieval: `ai-retrieve-context` + `match_ai_embeddings`
- `ai-retrieve-context` embeds query and calls `match_ai_embeddings` with filters (doc_types/modules/min_similarity) (evidence: `supabase/functions/ai-retrieve-context/index.ts:129`).

### Retrieval inside strategy generation
- `ai-strategy-generate` calls `match_ai_embeddings` (client + agency + exemplars) and builds prompt context from returned chunks (evidence: `supabase/functions/ai-strategy-generate/index.ts:274`, `supabase/functions/ai-strategy-generate/index.ts:383`).

---

## Control flow diagram (data lineage)
### Lineage A: Brain document version → RAG
Step 1 → User creates/edits `brain_documents` drafts and `brain_document_versions` (evidence: `src/hooks/useBrainDocuments.ts:146`, `src/hooks/useBrainDocuments.ts:226`).
Step 2 → User activates a doc (approve) via `ai-brain-document-approve` (evidence: `src/hooks/useBrainDocuments.ts:256`).
Step 3 → Server marks it approved (archives prior approved) (evidence: `supabase/functions/_shared/brain-documents.ts:335`, `supabase/functions/_shared/brain-documents.ts:345`).
Step 4 → Server converts doc to markdown string and truncates extracted text (evidence: `supabase/functions/_shared/brain-documents.ts:611`, `supabase/functions/_shared/brain-documents.ts:648`).
Step 5 → Server tokenizes + chunks text (evidence: `supabase/functions/_shared/brain-documents.ts:650`, `supabase/functions/_shared/embeddings.ts:21`).
Step 6 → Server deletes prior `ai_documents` for same module (agency_id + doc_type + module metadata) (evidence: `supabase/functions/_shared/brain-documents.ts:657`).
Step 7 → Server inserts:
  - `ai_documents` (`doc_type='brain_document'`) with metadata `{brain_document_id,module,version,status,approved_at,chunk_size_tokens,overlap_tokens,max_chunks_per_doc,token_count}` (evidence: `supabase/functions/_shared/brain-documents.ts:669`, `supabase/functions/_shared/brain-documents.ts:675`).
Step 8 → For each chunk:
  - insert `ai_document_chunks` with `embedding_status='failed'` initially (evidence: `supabase/functions/_shared/brain-documents.ts:697`, `supabase/functions/_shared/brain-documents.ts:705`).
  - compute embedding via `embedWithPolicy(...)` and `embedText(...)` (evidence: `supabase/functions/_shared/brain-documents.ts:714`, `supabase/functions/_shared/embeddings.ts:45`).
  - persist embedding to `ai_embeddings` and flip chunk `embedding_status` to ok (evidence: `supabase/functions/_shared/brain-documents.ts:721`, `supabase/functions/_shared/embedding-store.ts:35`).

### Lineage B: Client onboarding → Client brain → RAG “ai_artifact” summary
Step 1 → Client onboarding UI creates/updates `client_brains` via `ai-brains-client` (evidence: `src/components/onboarding-v5/OnboardingV5Wizard.tsx:597`).
Step 2 → UI calls `ai-brain-ingest` with `scope='client'` and `raw_responses` (evidence: `src/components/onboarding-v5/OnboardingV5Wizard.tsx:621`).
Step 3 → Server maps raw responses → structured client brain JSON and sets `client_brains.usable` (evidence: `supabase/functions/ai-brain-ingest/index.ts:310`, `supabase/functions/ai-brain-ingest/index.ts:313`).
Step 4 → Server writes a “Client brain summary” to:
  - `ai_memory_items` (evidence: `supabase/functions/ai-brain-ingest/index.ts:322`).
  - `ai_documents` as `doc_type='ai_artifact'` and embeds it (evidence: `supabase/functions/ai-brain-ingest/index.ts:333`, `supabase/functions/ai-brain-ingest/index.ts:355`).

---

## Chunking algorithm (exact location + parameters)
### Tokenization
- Tokenization is **whitespace splitting**, not model-token-based:
  - `tokenize(text) { return text.trim().split(/\\s+/) }` (evidence: `supabase/functions/_shared/embeddings.ts:17`).

### Chunk building
- Sliding-window chunk builder:
  - Step size = `max(chunkSizeTokens - overlapTokens, 1)` (evidence: `supabase/functions/_shared/embeddings.ts:30`).
  - Each chunk is `tokens.slice(start, end).join(" ")` (evidence: `supabase/functions/_shared/embeddings.ts:33`).

### Chunk sizes / overlap / max chunks (per pipeline)
- Brain document ingestion (module docs):
  - `CHUNK_SIZE_TOKENS = 900`
  - `OVERLAP_TOKENS = 140`
  - `MAX_CHUNKS = 120`
  - (evidence: `supabase/functions/_shared/brain-documents.ts:81`).
- Brain ingest summaries (`ai-brain-ingest` endpoint):
  - `CHUNK_SIZE_TOKENS = 900`
  - `OVERLAP_TOKENS = 140`
  - `MAX_CHUNKS = 12`
  - (evidence: `supabase/functions/ai-brain-ingest/index.ts:12`).

**Implication (current truth)**:
- The same chunk sizes are used, but summary docs cap the number of chunks far more aggressively (`12` vs `120`) (evidence: `supabase/functions/ai-brain-ingest/index.ts:14`, `supabase/functions/_shared/brain-documents.ts:83`).

---

## Embedding model, dimensions, and error handling
### Dimensions
- Default expected dimension is 1536, configurable by `AI_EMBED_DIM_EXPECTED` (evidence: `supabase/functions/_shared/embeddings.ts:4`, `supabase/functions/_shared/embeddings.ts:8`).
- DB column uses `vector(1536)` in `ai_embeddings.embedding` (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:78`).

### Model selection
- Default embedding model fallback is `"text-embedding-3-small"` when env `EMBEDDING_MODEL_ID` is not set (evidence: `supabase/functions/_shared/brain-documents.ts:642`, `supabase/functions/ai-brain-ingest/index.ts:239`).

### Fail-hard vs soft-fail behavior
- Policy wrapper:
  - If `OPENAI_API_KEY` missing and `failHard=false`, returns `{status:'failed', errorCode:'MISSING_API_KEY'}` (evidence: `supabase/functions/_shared/embedding-policy.ts:17`).
  - If `failHard=true`, throws error code `MISSING_API_KEY` (evidence: `supabase/functions/_shared/embedding-policy.ts:18`).
- Persist behavior:
  - If embedding result isn’t ok → `ai_document_chunks.embedding_status='failed'` and no `ai_embeddings` insert (evidence: `supabase/functions/_shared/embedding-store.ts:22`).
  - If embedding insert succeeds → set `embedding_status='ok'` (evidence: `supabase/functions/_shared/embedding-store.ts:35`).

---

## Retrieval: where it happens and what it returns
### Retrieval RPC: `public.match_ai_embeddings`
Current signature includes:
- `p_agency_id`, `p_query_embedding`, `p_client_id`, `p_match_count`, `p_doc_types`, `p_modules`, `p_min_similarity` (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:11`).
Filters include:
- Exclude failed chunk embeddings: `c.embedding_status = 'ok'` (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:46`).
- Exclude unapproved brain documents: `(e.doc_type <> 'brain_document' or (d.metadata->>'status')='approved')` (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:50`).

### Retrieval endpoint: `ai-retrieve-context`
- Embeds query string via `embedText(query, OPENAI_API_KEY, EMBEDDING_MODEL_ID)` (evidence: `supabase/functions/ai-retrieve-context/index.ts:126`).
- Calls `match_ai_embeddings` with filters and returns `{snippet, score, source, source_id}` (evidence: `supabase/functions/ai-retrieve-context/index.ts:129`, `supabase/functions/ai-retrieve-context/index.ts:155`).

### Retrieval inside strategy generation
Strategy generation uses retrieval in two modes:
- **Legacy mode**: directly truncates joined chunks to 6000 chars (evidence: `supabase/functions/ai-strategy-generate/index.ts:332`, `supabase/functions/ai-strategy-generate/index.ts:334`).
- **Centralized policy mode** (when enabled):
  - uses `getRagConfig(TaskType.STRATEGY_PLAN)` and `applyRagPolicy(...)` to cap/choose matches (evidence: `supabase/functions/ai-strategy-generate/index.ts:259`, `src/ai/ragPolicy.ts:72`, `src/ai/ragPolicy.ts:94`).

---

## Proving whether RAG is used in strategy generation (not just stored)
- **YES, RAG is actually used**, because `ai-strategy-generate` calls `match_ai_embeddings` and then places the returned chunk text into `promptContext` as `RAG Context:\n${context}` (evidence: `supabase/functions/ai-strategy-generate/index.ts:274`, `supabase/functions/ai-strategy-generate/index.ts:386`).
- If retrieval returns zero matches, the endpoint returns an unknown response instructing to upload memory (“Upload client guidelines…”) (evidence: `supabase/functions/ai-strategy-generate/index.ts:310`, `supabase/functions/ai-strategy-generate/index.ts:322`).

---

## “References” behavior (how citations are built today)
- `ai-strategy-generate` collects `selectedMatches` and builds a “referencesSection” for brain_document matches by joining to `ai_documents` rows (evidence: `supabase/functions/ai-strategy-generate/index.ts:355`, `supabase/functions/ai-strategy-generate/index.ts:364`).
- It also stores citation metadata in `ai_runs.citations.memory_citations` (evidence: `supabase/functions/ai-strategy-generate/index.ts:536`).
- It validates citations and can fail hard when `AI_SCHEMA_STRICT=true` (evidence: `supabase/functions/ai-strategy-generate/index.ts:105`, `supabase/functions/ai-strategy-generate/index.ts:554`).

---

## AI behavior summary for this module — YES/NO/UNKNOWN
- **Embeddings exist**: YES (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:78`).
- **Chunking exists**: YES (evidence: `supabase/functions/_shared/embeddings.ts:21`).
- **RAG retrieval exists**: YES (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:11`).
- **RAG is used by strategy generation**: YES (evidence: `supabase/functions/ai-strategy-generate/index.ts:386`).
- **RAG is used by AI Setup UI directly**: NO (evidence: `src/pages/agency/AISetup.tsx:27`).

---

## “Source of truth” (what decides whether content is usable)
- Chunk-level: `ai_document_chunks.embedding_status` decides whether a chunk is eligible for retrieval (evidence: `supabase/migrations/20260105140000_embedding_chunk_status.sql:4`, `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:46`).
- Brain-doc eligibility: `ai_documents.metadata->>'status'='approved'` is required for `doc_type='brain_document'` retrieval (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:50`).
- UI “ingestion health” for core modules: existence of `ai_documents` with module metadata for approved defaults (evidence: `supabase/functions/ai-default-brain-pack-ingestion-health/index.ts:78`).

---

## Cross-tenant risks and isolation enforcement
- Retrieval RPC filters only by `d.agency_id = p_agency_id`; correct usage depends on callers passing the correct agency id and on EXECUTE privileges being restricted (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:45`).
- Edge functions typically validate membership before calling retrieval (example: `ai-retrieve-context`) (evidence: `supabase/functions/ai-retrieve-context/index.ts:95`).
- **UNKNOWN**: whether `match_ai_embeddings` is service-role-only after signature changes (verify in DB) (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:3`).

---

## Explicit answers required by the mission
### Q9) Does Agency AI Setup impact client strategy generation? Where exactly?
- **YES**, via RAG retrieval of `doc_type='brain_document'` in `ai-strategy-generate` (evidence: `supabase/functions/ai-strategy-generate/index.ts:271`).

### Q10) Are Agency Brain docs embedded and used as RAG? Which tables store chunks/embeddings?
- **YES** (once ingested):
  - `ai_documents` stores module docs as `doc_type='brain_document'` (evidence: `supabase/functions/_shared/brain-documents.ts:669`).
  - `ai_document_chunks` stores chunk text and embedding_status (evidence: `supabase/functions/_shared/brain-documents.ts:697`).
  - `ai_embeddings` stores vectors (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:78`).

### Q11) What is the end goal, and where does current code diverge?
- Goal implied by migrations: “approved-only retrieval for brain docs” and ignoring failed chunks (evidence: `supabase/migrations/20260108123000_brain_documents_rag.sql:1`, `supabase/migrations/20260105140000_embedding_chunk_status.sql:1`).
- Divergences / limitations:
  - Tokenization is whitespace-based, not model-token-based (may impact chunk boundaries and token counts) (evidence: `supabase/functions/_shared/embeddings.ts:17`).
  - Privilege hardening drift risk for `match_ai_embeddings` after signature changes is addressed by a follow-up hardening migration in this repo, but it still must be applied/verified in the deployed DB (evidence: `supabase/migrations/20251224133000_harden_match_ai_embeddings_exec.sql:27`, `supabase/migrations/20260118000001_harden_match_ai_embeddings_final.sql:1`).

---

## Failure modes (top 5) + how they surface
1) **OPENAI_API_KEY missing** → embeddings fail; `ai-retrieve-context` returns 500 and `ai-strategy-generate` returns 500 with `code=MISSING_API_KEY` (evidence: `supabase/functions/_shared/embedding-policy.ts:19`, `supabase/functions/ai-retrieve-context/index.ts:121`, `supabase/functions/ai-strategy-generate/index.ts:231`).
2) **Embedding dimension mismatch** → hard failure in ingestion for brain docs and summaries (evidence: `supabase/functions/_shared/embeddings.ts:60`, `supabase/functions/_shared/brain-documents.ts:740`, `supabase/functions/ai-brain-ingest/index.ts:296`).
3) **Chunk insert / embedding insert fails** → chunk remains failed, retrieval filters it out (evidence: `supabase/functions/_shared/embedding-store.ts:23`, `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:46`).
4) **`match_ai_embeddings` privileges incorrect** → retrieval returns error and upstream endpoints fail/return unknown (evidence: `supabase/functions/ai-retrieve-context/index.ts:139`).
5) **No matches retrieved** → strategy returns `unknown=true` with “Upload client guidelines…” (evidence: `supabase/functions/ai-strategy-generate/index.ts:310`, `supabase/functions/ai-strategy-generate/index.ts:322`).

---

## Verification checklist (commands + SQL)
### Repo commands (required by request)
- `npm test`
- `npm run lint`
- `npx tsc -p tsconfig.json --noEmit`
- `npm run build`

### SQL lineage checks (brain docs)
```sql
-- 1) Find approved brain documents for an agency
select id, module, status, approved_at, version
from public.brain_documents
where agency_id = :agency_id
and status = 'approved';
```

```sql
-- 2) Follow into ai_documents (brain_document)
select id, metadata, created_at
from public.ai_documents
where agency_id = :agency_id
and doc_type = 'brain_document'
order by created_at desc;
```

```sql
-- 3) Chunk + embedding counts (brain_document)
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

### SQL retrieval sanity check (requires ability to call RPC)
```sql
-- WARNING: calling match_ai_embeddings requires providing a vector.
-- Verify privileges instead (see 02_DB_SCHEMA_RLS_MIGRATIONS.md).
select 1;
```
