-- Phase 2: Contextual ingestion allowlist (poisoning defense)
--
-- Purpose:
-- - require explicit allowlisting of ingestion sources per tenant (agency_id)
-- - protect against unknown/untrusted source_ref injection
-- - maintain "0 cross-tenant leaks" via RLS on agency_id

create table if not exists public.ai_ingestion_sources (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  source_type text not null,
  source_ref text not null,
  source_url text,
  allowed boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists ai_ingestion_sources_unique
  on public.ai_ingestion_sources (agency_id, source_type, source_ref);

create index if not exists ai_ingestion_sources_agency_created
  on public.ai_ingestion_sources (agency_id, created_at desc);

alter table public.ai_ingestion_sources enable row level security;

create policy "ai_ingestion_sources_select"
  on public.ai_ingestion_sources
  for select to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_ingestion_sources_insert_admin"
  on public.ai_ingestion_sources
  for insert to authenticated
  with check (
    exists (
      select 1 from public.agency_members am
      where am.agency_id = ai_ingestion_sources.agency_id
        and am.user_id = auth.uid()
        and am.role = 'admin'
    )
  );

create policy "ai_ingestion_sources_update_admin"
  on public.ai_ingestion_sources
  for update to authenticated
  using (
    exists (
      select 1 from public.agency_members am
      where am.agency_id = ai_ingestion_sources.agency_id
        and am.user_id = auth.uid()
        and am.role = 'admin'
    )
  );

create policy "ai_ingestion_sources_delete_admin"
  on public.ai_ingestion_sources
  for delete to authenticated
  using (
    exists (
      select 1 from public.agency_members am
      where am.agency_id = ai_ingestion_sources.agency_id
        and am.user_id = auth.uid()
        and am.role = 'admin'
    )
  );

grant select, insert, update, delete on table public.ai_ingestion_sources to authenticated;

