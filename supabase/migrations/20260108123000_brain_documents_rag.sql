-- Add brain_document doc type and enforce approved-only retrieval for brain docs

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
    'strategy_draft',
    'brain_document'
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
    and c.embedding_status = 'ok'
    and (p_client_id is null or d.client_id = p_client_id)
    and (p_doc_types is null or e.doc_type = any(p_doc_types))
    and (e.doc_type <> 'brain_document' or (d.metadata->>'status') = 'approved')
  order by e.embedding <=> p_query_embedding
  limit p_match_count;
$$;
