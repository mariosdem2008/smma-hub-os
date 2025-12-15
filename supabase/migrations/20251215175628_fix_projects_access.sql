-- 0) Ensure schema usage
grant usage on schema public to anon, authenticated;

-- 1) GRANTS (this is what your error screams)
grant select on public.projects to authenticated;
-- If your app creates/updates projects:
grant insert, update, delete on public.projects to authenticated;

-- 2) RLS (make sure it's on)
alter table public.projects enable row level security;

-- 3) Policy: members of the agency can read projects
drop policy if exists "projects_select_agency_members_v2" on public.projects;
create policy "projects_select_agency_members_v2"
on public.projects
for select
to authenticated
using (public.is_member_of_agency(agency_id));

-- 4) Optional: allow writes for members (only if needed)
drop policy if exists "projects_write_agency_members_v2" on public.projects;
create policy "projects_write_agency_members_v2"
on public.projects
for insert
to authenticated
with check (public.is_member_of_agency(agency_id));

-- Update/delete if you actually do them from client-side:
drop policy if exists "projects_update_agency_members_v2" on public.projects;
create policy "projects_update_agency_members_v2"
on public.projects
for update
to authenticated
using (public.is_member_of_agency(agency_id))
with check (public.is_member_of_agency(agency_id));

drop policy if exists "projects_delete_agency_members_v2" on public.projects;
create policy "projects_delete_agency_members_v2"
on public.projects
for delete
to authenticated
using (public.is_member_of_agency(agency_id));
