-- Phase 2: Episodic memory schema + safe retrieval scoping
--
-- Goals:
-- - Episodic memory storage supports thread_id + checkpoint_id + summary (per backlog P2-MEM-01).
-- - Capture cadence is handled at the edge function layer; schema supports it.
-- - Retrieval supports agency-scoped docs (client_id is null) without leaking other clients (0 cross-tenant leaks).

-- 1) Extend ai_memory_items with explicit episodic fields.
alter table public.ai_memory_items
  add column if not exists thread_id text,
  add column if not exists checkpoint_id uuid references public.ai_executor_checkpoints(id) on delete set null,
  add column if not exists summary text;

create index if not exists idx_ai_memory_items_agency_client_scope_thread_created
  on public.ai_memory_items (agency_id, client_id, scope, thread_id, created_at desc);

-- 2) Buffer table used to accumulate turns and write a single episodic summary every N turns.
create table if not exists public.ai_episodic_buffers (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  thread_id text not null,
  turns_json jsonb not null default '[]'::jsonb,
  turn_count integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (agency_id, client_id, thread_id)
);

create index if not exists idx_ai_episodic_buffers_agency_client_thread
  on public.ai_episodic_buffers (agency_id, client_id, thread_id);

alter table public.ai_episodic_buffers enable row level security;

-- Keep strict tenant scoping: only agency members can access buffers.
create policy "ai_episodic_buffers_select" on public.ai_episodic_buffers
  for select to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_episodic_buffers_insert" on public.ai_episodic_buffers
  for insert to authenticated
  with check (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_episodic_buffers_update" on public.ai_episodic_buffers
  for update to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_episodic_buffers_delete" on public.ai_episodic_buffers
  for delete to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

grant select, insert, update, delete on table public.ai_episodic_buffers to authenticated;

-- 3) Ensure doc_type constraint allows episodic-memory documents when ingested into ai_documents.
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
    'brain_document',
    'client_memory',
    'agency_memory',
    'client_episodic',
    'agency_episodic'
  ));

-- 4) Safer retrieval helper: include agency-scoped documents (client_id is null) without
-- returning other clients' docs when p_client_id is provided (0 cross-tenant leaks).
create or replace function public.match_ai_embeddings_scoped(
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

