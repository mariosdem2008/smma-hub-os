-- Add filters and thresholds to match_ai_embeddings

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
  from public.ai_embeddings e
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
