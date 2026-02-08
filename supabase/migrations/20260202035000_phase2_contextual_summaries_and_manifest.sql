-- Phase 2: Contextual ingestion summaries + manifest validation
--
-- Goals:
-- - Store 50-100 token per-chunk summaries (P2-RAG-01) to support contextual ingestion.
-- - Add optional manifest fields to ingestion allowlist for poisoning defense (P2-RAG-02).
-- - Maintain strict tenant scoping and 0 cross-tenant leaks via agency_id checks and existing RLS.

-- 1) Per-chunk summaries (stored alongside chunk text; provenance is implicit via document_id + chunk_index).
alter table public.ai_document_chunks
  add column if not exists chunk_summary text,
  add column if not exists chunk_summary_tokens integer,
  add column if not exists chunk_summary_model text,
  add column if not exists chunk_summary_status text not null default 'pending'
    check (chunk_summary_status in ('pending','ok','failed'));

create index if not exists idx_ai_document_chunks_summary_status
  on public.ai_document_chunks (chunk_summary_status);

-- 2) Ingestion source manifest validation (optional, but enforceable when present).
alter table public.ai_ingestion_sources
  add column if not exists manifest_sha256 text,
  add column if not exists manifest_json jsonb,
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_ai_ingestion_sources_updated_at on public.ai_ingestion_sources;
create trigger trg_ai_ingestion_sources_updated_at
  before update on public.ai_ingestion_sources
  for each row execute function public.update_updated_at_column();

