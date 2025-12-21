-- 1) Ensure base privileges exist (this fixes "permission denied for table ...")
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.client_invites to authenticated;

-- 2) Ensure RLS is enabled (optional but recommended for security)
alter table public.client_invites enable row level security;

-- 3) Replace policies with a strict agency-membership based rule
do $$
begin
  -- drop older policies if they exist (names may differ; adjust if needed)
  if exists (select 1 from pg_policies where schemaname='public' and tablename='client_invites' and policyname='client_invites_manage') then
    execute 'drop policy client_invites_manage on public.client_invites';
  end if;

  if exists (select 1 from pg_policies where schemaname='public' and tablename='client_invites' and policyname='client_invites_delete') then
    execute 'drop policy client_invites_delete on public.client_invites';
  end if;

  if exists (select 1 from pg_policies where schemaname='public' and tablename='client_invites' and policyname='client_invites_select') then
    execute 'drop policy client_invites_select on public.client_invites';
  end if;

  if exists (select 1 from pg_policies where schemaname='public' and tablename='client_invites' and policyname='client_invites_insert') then
    execute 'drop policy client_invites_insert on public.client_invites';
  end if;

  if exists (select 1 from pg_policies where schemaname='public' and tablename='client_invites' and policyname='client_invites_update') then
    execute 'drop policy client_invites_update on public.client_invites';
  end if;
end $$;

-- SELECT: agency members can view invites for their agency
create policy client_invites_select
on public.client_invites
for select
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = client_invites.agency_id
      and am.user_id = auth.uid()
  )
);

-- INSERT: only owner/admin/manager can create invites
create policy client_invites_insert
on public.client_invites
for insert
to authenticated
with check (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = client_invites.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner','admin','manager')
  )
);

-- UPDATE: only owner/admin/manager can update invites
create policy client_invites_update
on public.client_invites
for update
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = client_invites.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner','admin','manager')
  )
)
with check (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = client_invites.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner','admin','manager')
  )
);

-- DELETE: only owner/admin/manager can delete invites
create policy client_invites_delete
on public.client_invites
for delete
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = client_invites.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner','admin','manager')
  )
);
