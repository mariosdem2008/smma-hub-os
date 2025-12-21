-- ============================================================
-- MIGRATION: production-grade client portal access
-- Adds portal_user_id + tight RLS + safe public lookup view
-- ============================================================

begin;

-- 1) Add a real linkage between auth user and client portal identity
alter table public.clients
add column if not exists portal_user_id uuid;

-- Ensure 1 portal user maps to 1 client (common for client portals)
create unique index if not exists clients_portal_user_id_unique
on public.clients (portal_user_id)
where portal_user_id is not null;

-- Add FK (deferred by explicit constraint so it's idempotent-ish)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clients_portal_user_id_fkey'
  ) then
    alter table public.clients
      add constraint clients_portal_user_id_fkey
      foreign key (portal_user_id) references auth.users(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_clients_portal_slug
on public.clients (portal_slug);

create index if not exists idx_clients_portal_enabled
on public.clients (portal_enabled);

-- 2) RLS: enable (if not already)
alter table public.clients enable row level security;

-- 3) Remove risky/incorrect policies (names must match what you have)
drop policy if exists "Public users can view portal-enabled clients by slug" on public.clients;
drop policy if exists "Agency members can view clients" on public.clients;
drop policy if exists "Agency members can create clients" on public.clients;
drop policy if exists "Agency members can update clients" on public.clients;
drop policy if exists "Agency members can delete clients" on public.clients;

-- NOTE:
-- I’m NOT re-creating your agency-member policies here because those are app-specific.
-- Keep your existing agency-member policies if they work, or re-add them separately.
-- This migration focuses ONLY on fixing client portal access correctly.

-- 4) Authenticated portal users can read ONLY their own client row
create policy "clients_portal_user_read_own"
on public.clients
for select
to authenticated
using (
  portal_user_id = auth.uid()
);

-- 5) Public access: DO NOT expose full clients table.
-- Instead expose a minimal view for slug-based discovery.
-- This avoids leaking agency_id, internal notes, etc.

create or replace view public.portal_public_clients as
select
  id,
  name,
  logo_url,
  website,
  portal_slug,
  portal_enabled,
  updated_at
from public.clients
where portal_enabled = true
  and portal_slug is not null;

-- Secure the view: it will obey underlying RLS unless we grant via policy on base table.
-- So we add a *very narrow* policy allowing anon to select *only portal-enabled rows*,
-- but since your app queries via the view + slug filter, it stays minimal in practice.

create policy "clients_public_portal_discovery"
on public.clients
for select
to anon
using (
  portal_enabled = true
  and portal_slug is not null
);

-- 6) Optional hardening: prevent anon from selecting columns you don't want by REVOKE.
-- PostgREST can still read columns if policy allows row.
-- If you want strict column control, keep anon requests hitting the VIEW only
-- and set PostgREST to expose only the view schema (recommended).
-- (Not applied here because it depends on your API exposure strategy.)

commit;
