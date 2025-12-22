-- Restore agency admin/manager access to clients (RLS)
begin;

drop policy if exists clients_select_agency_admins on public.clients;
create policy clients_select_agency_admins
on public.clients
for select
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = clients.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner', 'admin', 'manager')
  )
);

drop policy if exists clients_update_agency_admins on public.clients;
create policy clients_update_agency_admins
on public.clients
for update
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = clients.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner', 'admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = clients.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner', 'admin', 'manager')
  )
);

commit;
