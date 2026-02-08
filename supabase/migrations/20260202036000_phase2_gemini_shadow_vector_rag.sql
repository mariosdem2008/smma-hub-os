-- Phase 2: Shadow Gemini pgvector storage + retrieval RPCs (cutover-ready)
--
-- Purpose:
-- - Enable a reversible cutover path from OpenAI embeddings to Gemini embeddings for RAG retrieval.
-- - Keep 0 cross-tenant leaks: queries are scoped by agency_id and (optionally) client_id, and only
--   agency-scoped docs (client_id is null) are included when safe.
--
-- IMPORTANT:
-- - This table uses vector(768). Set GEMINI_EMBED_DIM_EXPECTED=768 in runtime config/secrets.

create table if not exists public.ai_embeddings_shadow_gemini_vector (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  doc_type text not null,
  document_id uuid not null references public.ai_documents(id) on delete cascade,
  chunk_id uuid not null references public.ai_document_chunks(id) on delete cascade,
  embedding vector(768) not null,
  model text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_embeddings_shadow_vec_filter
  on public.ai_embeddings_shadow_gemini_vector(agency_id, client_id, doc_type);

alter table public.ai_embeddings_shadow_gemini_vector enable row level security;

create policy "ai_embeddings_shadow_vec_select" on public.ai_embeddings_shadow_gemini_vector
  for select to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_embeddings_shadow_vec_insert" on public.ai_embeddings_shadow_gemini_vector
  for insert to authenticated
  with check (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_embeddings_shadow_vec_update" on public.ai_embeddings_shadow_gemini_vector
  for update to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_embeddings_shadow_vec_delete" on public.ai_embeddings_shadow_gemini_vector
  for delete to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

grant select, insert, update, delete on table public.ai_embeddings_shadow_gemini_vector to authenticated;

-- Match function for Gemini shadow vectors (client-scoped only; mirrors match_ai_embeddings signature style).
create or replace function public.match_ai_embeddings_shadow_gemini(
  p_agency_id uuid,
  p_query_embedding vector(768),
  p_client_id uuid default null,
  p_match_count int default 8,
  p_doc_types text[] default null,
  p_modules text[] default null,
  p_min_similarity float8 default 0.2
)
returns table (
  document_id uuid,
  chunk_id uuid,
  doc_type text,
  chunk_text text,
  score float8,
  title text,
  source jsonb,
  source_url text
)
language sql
stable
as $$
  select
    e.document_id,
    e.chunk_id,
    e.doc_type,
    c.chunk_text,
    1 - (e.embedding <=> p_query_embedding) as score,
    d.title,
    d.source,
    d.source_url
  from public.ai_embeddings_shadow_gemini_vector e
  join public.ai_document_chunks c on c.id = e.chunk_id
  join public.ai_documents d on d.id = e.document_id
  where d.agency_id = p_agency_id
    and c.embedding_status = 'ok'
    and (p_client_id is null or d.client_id = p_client_id)
    and (p_doc_types is null or e.doc_type = any(p_doc_types))
    and (p_modules is null or (d.metadata->>'module') = any(p_modules))
    and (e.doc_type <> 'brain_document' or (d.metadata->>'status') = 'approved')
    and (1 - (e.embedding <=> p_query_embedding)) >= p_min_similarity
  order by e.embedding <=> p_query_embedding
  limit least(p_match_count, 12);
$$;

-- Scoped variant: include agency-scoped docs without leaking other clients.
create or replace function public.match_ai_embeddings_shadow_gemini_scoped(
  p_agency_id uuid,
  p_query_embedding vector(768),
  p_client_id uuid default null,
  p_match_count int default 8,
  p_doc_types text[] default null,
  p_modules text[] default null,
  p_min_similarity float8 default 0.2
)
returns table (
  document_id uuid,
  chunk_id uuid,
  doc_type text,
  chunk_text text,
  score float8,
  title text,
  source jsonb,
  source_url text
)
language sql
stable
as $$
  select
    e.document_id,
    e.chunk_id,
    e.doc_type,
    c.chunk_text,
    1 - (e.embedding <=> p_query_embedding) as score,
    d.title,
    d.source,
    d.source_url
  from public.ai_embeddings_shadow_gemini_vector e
  join public.ai_document_chunks c on c.id = e.chunk_id
  join public.ai_documents d on d.id = e.document_id
  where d.agency_id = p_agency_id
    and c.embedding_status = 'ok'
    and (
      p_client_id is null
      or d.client_id = p_client_id
      or (
        d.client_id is null
        and e.doc_type = any(array['agency_exemplar_strategy','agency_sop','agency_memory','agency_episodic'])
      )
    )
    and (p_doc_types is null or e.doc_type = any(p_doc_types))
    and (p_modules is null or (d.metadata->>'module') = any(p_modules))
    and (e.doc_type <> 'brain_document' or (d.metadata->>'status') = 'approved')
    and (1 - (e.embedding <=> p_query_embedding)) >= p_min_similarity
  order by e.embedding <=> p_query_embedding
  limit least(p_match_count, 12);
$$;

