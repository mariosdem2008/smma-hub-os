# Default Brain Pack v1 — RAG + Embeddings Audit (post AI Setup redesign)

## Ingestion pipeline (approve → index)

- Approval sets `brain_documents.status='approved'`: `supabase/functions/_shared/brain-documents.ts`
- Ingestion hard-gates approved-only: `supabase/functions/_shared/brain-documents.ts`
- Ingestion writes:
  - Deletes existing `ai_documents` rows scoped to `agency_id` + `doc_type` + module: `supabase/functions/_shared/brain-documents.ts`
  - Inserts `ai_documents` with metadata containing `brain_document_id`, `module`, `version`, `status`: `supabase/functions/_shared/brain-documents.ts`
  - Inserts `ai_document_chunks` and then `ai_embeddings`: `supabase/functions/_shared/embedding-store.ts`

## Retrieval correctness + gating

- `match_ai_embeddings` filters `brain_document` to approved only: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql`
- Strategy generation requests `brain_document` for agency context and calls retrieval: `supabase/functions/ai-strategy-generate/index.ts`
- Strategy prompt context includes deterministic References for `brain_document` chunks:
  - Formatting helper: `supabase/functions/_shared/strategy-references.ts`
  - Response includes `rag_debug` with chunk counts + references: `supabase/functions/ai-strategy-generate/index.ts`

## Ingest-only mode (retry)

- Edge supports an ingest-only retry that does not create docs:
  - Mode switch: `supabase/functions/ai-seed-default-brain-pack/index.ts`
  - Implementation reads approved defaults then ingests: `supabase/functions/_shared/seed-default-brain-pack.ts`

## UI visibility (what changed)

- Ingestion failures for approved default modules are now surfaced in the UI using:
  - Health check: `src/hooks/useDefaultBrainPackIngestionHealth.ts`
  - Overview + detail display status: `src/lib/brain/statusTypes.ts` and `src/pages/agency/AISetup.tsx`

## Embedding dimension safety

- Expected dimension defaults to 1536: `supabase/functions/_shared/embeddings.ts`
- Enforced mismatch throws: `supabase/functions/_shared/embeddings.ts`
- Missing key behavior:
  - If embeddings are skipped, chunks remain `embedding_status='failed'` and ingestion health will not clear.

## Multi-tenant safety (ingest delete scoping)

- Pre-ingest delete is scoped by `agency_id` (prevents cross-tenant deletes):
  - `supabase/functions/_shared/brain-documents.ts`
- Test asserts delete includes `agency_id`:
  - `supabase/functions/_shared/__tests__/brain-documents-ingest.test.ts`

## UNKNOWNs (require runtime verification)

- Whether `ai_documents` / `ai_embeddings` RLS policies are sufficient for multi-tenant isolation (not audited here).
  - Verification: inspect migrations defining these tables and policies in `supabase/migrations`.

