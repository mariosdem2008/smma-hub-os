-- allow owners/admins/managers of the agency to delete client_invites
create policy "client_invites_delete_by_agency_role"
on public.client_invites
for delete
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = client_invites.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner','admin','manager')
  )
);
