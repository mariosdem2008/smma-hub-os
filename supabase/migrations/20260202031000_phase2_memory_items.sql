-- Phase 2: Memory tiers (episodic + long-term approval)
--
-- Goals:
-- - support scoped memory (working/episodic/long_term)
-- - support approval gating for long-term memory
-- - keep strict tenant scoping and 0 cross-tenant leaks via agency_id

alter table public.ai_memory_items
  add column if not exists scope text not null default 'long_term'
    check (scope in ('working','episodic','long_term')),
  add column if not exists status text not null default 'proposed'
    check (status in ('proposed','active','rejected')),
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_by uuid references auth.users(id) on delete set null,
  add column if not exists rejected_at timestamptz,
  add column if not exists source_ref text;

create index if not exists idx_ai_memory_items_agency_status_created
  on public.ai_memory_items (agency_id, status, created_at desc);

create index if not exists idx_ai_memory_items_agency_client_scope_created
  on public.ai_memory_items (agency_id, client_id, scope, created_at desc);

-- RLS policies already exist; add explicit grants (RLS does not imply privileges).
grant select, insert, update, delete on table public.ai_memory_items to authenticated;
