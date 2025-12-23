-- Brain & Memory Spine v1 (additive)

alter table public.client_brains
  add column if not exists usable boolean not null default false;

create table if not exists public.ai_memory_items (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  type text not null,
  content text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  endpoint text not null,
  model text,
  tokens_estimate integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_memory_items_agency_client on public.ai_memory_items(agency_id, client_id, created_at);
create index if not exists idx_ai_usage_logs_agency_client on public.ai_usage_logs(agency_id, client_id, created_at);

alter table public.ai_memory_items enable row level security;
alter table public.ai_usage_logs enable row level security;

create policy "ai_memory_items_select" on public.ai_memory_items
  for select to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_memory_items_insert" on public.ai_memory_items
  for insert to authenticated
  with check (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_memory_items_update" on public.ai_memory_items
  for update to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_memory_items_delete" on public.ai_memory_items
  for delete to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_usage_logs_select" on public.ai_usage_logs
  for select to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_usage_logs_insert" on public.ai_usage_logs
  for insert to authenticated
  with check (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_usage_logs_update" on public.ai_usage_logs
  for update to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_usage_logs_delete" on public.ai_usage_logs
  for delete to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create or replace function public.match_ai_embeddings(
  p_agency_id uuid,
  p_client_id uuid default null,
  p_query_embedding vector(1536),
  p_match_count int default 8,
  p_doc_types text[] default null
)
returns table (
  document_id uuid,
  chunk_id uuid,
  doc_type text,
  chunk_text text,
  score float8
)
language sql
stable
as $$
  select
    e.document_id,
    e.chunk_id,
    e.doc_type,
    c.chunk_text,
    1 - (e.embedding <=> p_query_embedding) as score
  from public.ai_embeddings e
  join public.ai_document_chunks c on c.id = e.chunk_id
  join public.ai_documents d on d.id = e.document_id
  where e.agency_id = p_agency_id
    and (p_client_id is null or e.client_id = p_client_id)
    and (p_doc_types is null or e.doc_type = any(p_doc_types))
  order by e.embedding <=> p_query_embedding
  limit p_match_count;
$$;
