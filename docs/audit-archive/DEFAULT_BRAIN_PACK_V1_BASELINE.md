# Default Brain Pack v1 — Baseline Truth Snapshot (No Guess)

Scope: Default Agency Brain docs + UI examples + persistence + approval + RAG + strategy generation retrieval.

## 1) Current Agency Brain UI example system (examples/templates)

### Where examples are defined
- Example markdown sources live in `src/lib/brain/examples/*.md` (e.g. `src/lib/brain/examples/bootstrap.md`), and are imported as raw strings in `src/lib/brain/examples.ts:12`.
- The module → markdown mapping is `EXAMPLE_CONTENT` in `src/lib/brain/examples.ts:22`.
- Public accessors used by UI:
  - `getExampleContent(...)` in `src/lib/brain/examples.ts:37`
  - `getExamplePreview(...)` in `src/lib/brain/examples.ts:44`

### How they render when `moduleDocuments.length === 0`
- Empty-state branch is rendered when `moduleDocuments.length === 0` in `src/pages/agency/BrainLayerDetail.tsx:365`.
- The empty-state shows “Open Example” and calls `handleOpenPanel("example")` in `src/pages/agency/BrainLayerDetail.tsx:408`.
- The example UI component fetches the example markdown via:
  - `getExampleContent(module)` in `src/components/brain/layer-detail/ExampleDocCard.tsx:117`
  - `getExamplePreview(module, 15)` in `src/components/brain/layer-detail/ExampleDocCard.tsx:118`
- Rendering is client-side Markdown via `ReactMarkdown` in `src/components/brain/layer-detail/ExampleDocCard.tsx:27`.

### Confirm examples are NOT persisted unless user saves
- The example system reads markdown strings and renders them; it does not insert anything into `brain_documents`.
  - Reads: `getExampleContent(...)` in `src/components/brain/layer-detail/ExampleDocCard.tsx:117` and `src/lib/brain/examples.ts:37`.
- Persistence only happens on “Save”:
  - If there is no existing document, saving creates a draft via `useCreateBrainDocumentDraft()` in `src/components/brain/BrainModuleEditor.tsx:45`.
  - That draft write path inserts into `brain_documents` in `src/hooks/useBrainDocuments.ts:146`.

## 2) Current persistence system (brain docs + version history)

### `brain_documents` write paths
- Create draft (manual editor flow): insert into `brain_documents` in `src/hooks/useBrainDocuments.ts:146`.
- Create draft (upload flow): insert into `brain_documents` in `src/hooks/useBrainDocumentUpload.ts:167`.
- Update draft: update `brain_documents` in `src/hooks/useBrainDocuments.ts:214`.

### `brain_document_versions` write paths
- Create initial version for a new draft (manual editor flow): insert into `brain_document_versions` in `src/hooks/useBrainDocuments.ts:162`.
- Create initial version for a new draft (upload flow): insert into `brain_document_versions` in `src/hooks/useBrainDocumentUpload.ts:183`.
- Create new version on update: insert into `brain_document_versions` in `src/hooks/useBrainDocuments.ts:227`.

## 3) Approval + ingestion (brain_document → RAG)

### Endpoint that approves a brain_document
- UI invokes the edge function `ai-brain-document-approve` via `supabase.functions.invoke(...)` in `src/hooks/useBrainDocuments.ts:256`.
- The edge function handler approves + ingests:
  - `approveBrainDocument(...)` called in `supabase/functions/ai-brain-document-approve/index.ts:71`
  - `ingestBrainDocumentForRag(...)` called in `supabase/functions/ai-brain-document-approve/index.ts:72`

### Function that ingests into `ai_documents` / `ai_document_chunks` / `ai_embeddings`
- Ingestion entrypoint is `ingestBrainDocumentForRag(...)` in `supabase/functions/_shared/brain-documents.ts:618`.
- It requires approval before indexing: `if (doc.status !== "approved")` in `supabase/functions/_shared/brain-documents.ts:644`.
- Writes:
  - Deletes any prior `ai_documents` for the module: `supabase/functions/_shared/brain-documents.ts:657`
  - Inserts `ai_documents` row (`doc_type: "brain_document"`): `supabase/functions/_shared/brain-documents.ts:663`
  - Inserts `ai_document_chunks`: `supabase/functions/_shared/brain-documents.ts:696`
  - Persists embeddings (writes into embedding tables via `persistEmbeddingResult`): `supabase/functions/_shared/brain-documents.ts:720`

## 4) Strategy generation uses RAG (match_ai_embeddings) and NOT brain_documents table

### Confirm RAG retrieval usage
- Retrieval for strategy generation uses `match_ai_embeddings`:
  - Client memory retrieval: `supabase/functions/ai-strategy-generate/index.ts:273`
  - Agency memory retrieval (includes `brain_document` doc type): `supabase/functions/ai-strategy-generate/index.ts:283`
  - Exemplar retrieval: `supabase/functions/ai-strategy-generate/index.ts:293`

### Confirm it does not read `brain_documents` table
- The only `brain_documents` occurrence in `ai-strategy-generate` is the derived hash payload key (not a DB table read): `supabase/functions/ai-strategy-generate/index.ts:445`.
- When it needs brain-doc “module/version/status” it reads `ai_documents.metadata` (RAG document table), not `brain_documents`:
  - Reads `ai_documents` for matched brain docs: `supabase/functions/ai-strategy-generate/index.ts:421`.

## 5) Default Pack v1 target editors + expected `content_json` shape (keys)

### `BootstrapProfileEditor` (`module = "bootstrap"`)
- Schema keys (expected in `content_json`): `agency_name`, `niche`, `website`, `positioning`, `services`, `ideal_client_profile`, `pain_points`, `unique_value_proposition`, `target_industries` from `src/components/brain/editors/BootstrapProfileEditor.tsx:24`.

### `RepPolicyEditor` (`module = "rep_policy"`)
- Schema keys (expected in `content_json`): `ai_name`, `persona`, `response_sla`, `can_do`, `cannot_do`, `escalation_triggers`, `never_say`, `response_templates`, `tone_guidelines` from `src/components/brain/editors/RepPolicyEditor.tsx:28`.

### `QualityBarEditor` (`module = "quality_bar"`)
- Schema keys (expected in `content_json`):
  - `review_criteria[]` objects with `criterion`, `weight`, `description` from `src/components/brain/editors/QualityBarEditor.tsx:20`
  - `minimum_score`, `critical_criteria[]`, `non_negotiables[]`, `revision_policy.max_rounds`, `revision_policy.turnaround`, `escalation_triggers[]` objects with `trigger`, `escalate_to`, `action`, `qa_steps[]` from `src/components/brain/editors/QualityBarEditor.tsx:20`

## 6) RAG retrieval filter requires `doc_type='brain_document'` AND approved status

- `match_ai_embeddings` filters brain-doc matches to approved-only by reading `ai_documents.metadata->>'status'`:
  - `and (e.doc_type <> 'brain_document' or (d.metadata->>'status') = 'approved')` in `supabase/migrations/20260108123000_brain_documents_rag.sql:63`.
- Ingestion also enforces approval before indexing:
  - `Only approved brain documents can be indexed` check in `supabase/functions/_shared/brain-documents.ts:644`.

## Appendix: Quick verification commands

Run locally against your DB (replace agency UUID):

```sql
-- Brain docs exist?
select status, module, count(*)
from public.brain_documents
where agency_id = '00000000-0000-0000-0000-000000000000'
group by status, module
order by module, status;

-- Brain docs indexed into RAG?
select id, title, metadata
from public.ai_documents
where agency_id = '00000000-0000-0000-0000-000000000000'
  and doc_type = 'brain_document'
order by created_at desc;
```

