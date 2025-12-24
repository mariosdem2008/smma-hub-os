-- Strategy draft doc type + embeddings RPC update + tighter brain/embedding RLS

alter table public.ai_documents
  drop constraint if exists ai_documents_doc_type_check;

alter table public.ai_documents
  add constraint ai_documents_doc_type_check
  check (doc_type in (
    'agency_exemplar_strategy',
    'agency_sop',
    'client_guidelines',
    'client_notes',
    'approved_posts',
    'ai_artifact',
    'strategy_draft'
  ));

drop function if exists public.match_ai_embeddings(
  uuid,
  vector(1536),
  uuid,
  int,
  text[]
);

create or replace function public.match_ai_embeddings(
  p_agency_id uuid,
  p_query_embedding vector(1536),
  p_client_id uuid default null,
  p_match_count int default 8,
  p_doc_types text[] default null
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
  from public.ai_embeddings e
  join public.ai_document_chunks c on c.id = e.chunk_id
  join public.ai_documents d on d.id = e.document_id
  where d.agency_id = p_agency_id
    and (p_client_id is null or d.client_id = p_client_id)
    and (p_doc_types is null or e.doc_type = any(p_doc_types))
  order by e.embedding <=> p_query_embedding
  limit p_match_count;
$$;

drop policy if exists "agency_brains_select" on public.agency_brains;
create policy "agency_brains_select_service" on public.agency_brains
  for select to authenticated
  using (auth.role() = 'service_role');

drop policy if exists "client_brains_select" on public.client_brains;
create policy "client_brains_select_service" on public.client_brains
  for select to authenticated
  using (auth.role() = 'service_role');

drop policy if exists "ai_embeddings_select" on public.ai_embeddings;
create policy "ai_embeddings_select_service" on public.ai_embeddings
  for select to authenticated
  using (auth.role() = 'service_role');
