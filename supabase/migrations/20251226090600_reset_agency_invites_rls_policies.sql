begin;

-- IMPORTANT: remove legacy permissive policies (e.g. "Anyone can view invite by token")
-- and re-create only the canonical set for the unified invite flow.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'agency_invites'
  loop
    execute format('drop policy if exists %I on public.agency_invites', p.policyname);
  end loop;
end;
$$;

alter table public.agency_invites enable row level security;

-- Invited user can read their own invites (by JWT email claim).
create policy agency_invites_select_invited
  on public.agency_invites
  for select
  to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Agency admins can read invites for their agency (Team management UI).
create policy agency_invites_select_admin
  on public.agency_invites
  for select
  to authenticated
  using (public.is_agency_admin(agency_id, auth.uid()));

-- Only agency admins can create/update/delete invites for their agency.
create policy agency_invites_insert_admin
  on public.agency_invites
  for insert
  to authenticated
  with check (public.is_agency_admin(agency_id, auth.uid()));

create policy agency_invites_update_admin
  on public.agency_invites
  for update
  to authenticated
  using (public.is_agency_admin(agency_id, auth.uid()))
  with check (public.is_agency_admin(agency_id, auth.uid()));

create policy agency_invites_delete_admin
  on public.agency_invites
  for delete
  to authenticated
  using (public.is_agency_admin(agency_id, auth.uid()));

commit;

