# Default Brain Pack v1 — RAG + Embeddings Audit

## Ingestion pipeline (approve → index)

- Approval sets `brain_documents.status='approved'`: `supabase/functions/_shared/brain-documents.ts:344`.
- Ingestion hard-gates approved-only: `supabase/functions/_shared/brain-documents.ts:644`.
- Ingestion writes:
  - Deletes existing `ai_documents` for doc_type/module: `supabase/functions/_shared/brain-documents.ts:657`.
  - Inserts `ai_documents` with metadata containing `brain_document_id`, `module`, `version`, `status`: `supabase/functions/_shared/brain-documents.ts:663`.
  - Inserts `ai_document_chunks` with initial `embedding_status='failed'`: `supabase/functions/_shared/brain-documents.ts:696`.
  - Inserts `ai_embeddings` and marks chunk status ok/failed: `supabase/functions/_shared/embedding-store.ts:27` and `supabase/functions/_shared/embedding-store.ts:35`.

## Retrieval correctness + gating

- `match_ai_embeddings` filters `brain_document` to approved only: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:50`.
- Strategy generation requests `brain_document` for agency context: `supabase/functions/ai-strategy-generate/index.ts:270` and calls retrieval: `supabase/functions/ai-strategy-generate/index.ts:283`.
- Strategy prompt context includes only `doc_type` + `chunk_text` (no citation metadata): `supabase/functions/ai-strategy-generate/index.ts:332`.
  - Mismatch risk: users cannot see which module/doc a retrieved chunk came from unless you add citations.

## Embedding dimension safety

- Expected dimension defaults to 1536: `supabase/functions/_shared/embeddings.ts:4`.
- Enforced mismatch throws with code: `supabase/functions/_shared/embeddings.ts:60`.
- Missing key behavior:
  - Ingestion calls `embedWithPolicy` with `failHard` defaulting to env: `supabase/functions/_shared/brain-documents.ts:627`.
  - If key missing and failHard=false, embeddings are skipped (chunk stays failed): `supabase/functions/_shared/embedding-policy.ts:17`.

## Multi-tenant safety (ingest delete scoping)

- The pre-ingest delete is scoped by `agency_id` + `doc_type` + module:
  - `supabase/functions/_shared/brain-documents.ts:657`.
- Test asserts the delete includes `agency_id` (prevents cross-tenant deletes):
  - `supabase/functions/_shared/__tests__/brain-documents-ingest.test.ts:114`.

## Ingest-only mode (retry)

- Edge supports an ingest-only retry that does not create docs:
  - Mode switch: `supabase/functions/ai-seed-default-brain-pack/index.ts:104`.
  - Ingest-only implementation (reads approved defaults then ingests): `supabase/functions/_shared/seed-default-brain-pack.ts:113`.

## UNKNOWNs (require runtime verification)

- Whether `ai_documents` and `ai_embeddings` tables have RLS protections strong enough for multi-tenant isolation (not audited here).
  - Verification: inspect migrations defining these tables and policies:
    - `rg -n \"create table public\\.ai_documents|alter table public\\.ai_documents enable row level security\" supabase/migrations -S`
