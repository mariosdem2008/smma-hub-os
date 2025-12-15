-- 1) Basic schema access
grant usage on schema public to authenticated;

-- 2) Give PostgREST permission to hit the table at all
grant select, insert, update, delete on table public.agency_invites to authenticated;

-- 3) Ensure RLS is ON (recommended)
alter table public.agency_invites enable row level security;

-- 4) Helper: member of agency = owner OR agency_member
create or replace function public.is_member_of_agency(_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (select 1 from public.agencies a where a.id = _agency_id and a.user_id = auth.uid())
    or
    exists (select 1 from public.agency_members am where am.agency_id = _agency_id and am.user_id = auth.uid());
$$;

alter function public.is_member_of_agency(uuid) owner to postgres;
grant execute on function public.is_member_of_agency(uuid) to authenticated;

-- 5) Policies (drop + recreate to avoid duplicates)
drop policy if exists agency_invites_select_member on public.agency_invites;
drop policy if exists agency_invites_insert_member on public.agency_invites;
drop policy if exists agency_invites_update_member on public.agency_invites;
drop policy if exists agency_invites_delete_member on public.agency_invites;

create policy agency_invites_select_member
on public.agency_invites
for select
to authenticated
using (public.is_member_of_agency(agency_id));

create policy agency_invites_insert_member
on public.agency_invites
for insert
to authenticated
with check (public.is_member_of_agency(agency_id));

create policy agency_invites_update_member
on public.agency_invites
for update
to authenticated
using (public.is_member_of_agency(agency_id))
with check (public.is_member_of_agency(agency_id));

create policy agency_invites_delete_member
on public.agency_invites
for delete
to authenticated
using (public.is_member_of_agency(agency_id));
