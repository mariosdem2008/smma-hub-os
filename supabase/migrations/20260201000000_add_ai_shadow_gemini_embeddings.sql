-- Shadow Gemini embeddings table (Phase 0)

create table if not exists public.ai_embeddings_shadow_gemini (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  doc_type text not null,
  document_id uuid not null references public.ai_documents(id) on delete cascade,
  chunk_id uuid not null references public.ai_document_chunks(id) on delete cascade,
  embedding_json jsonb not null,
  model text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_embeddings_shadow_filter on public.ai_embeddings_shadow_gemini(agency_id, client_id, doc_type);

alter table public.ai_embeddings_shadow_gemini enable row level security;

create policy "ai_embeddings_shadow_select" on public.ai_embeddings_shadow_gemini
  for select to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_embeddings_shadow_insert" on public.ai_embeddings_shadow_gemini
  for insert to authenticated
  with check (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_embeddings_shadow_update" on public.ai_embeddings_shadow_gemini
  for update to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_embeddings_shadow_delete" on public.ai_embeddings_shadow_gemini
  for delete to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));
