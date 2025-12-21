begin;

-- 0) Make sure RLS is enabled (safe to run even if already enabled)
alter table public.client_users enable row level security;

-- 1) Fix the underlying PostgREST permission error:
-- Without this, you'll keep getting: "permission denied for table client_users"
grant select, insert, update, delete on table public.client_users to authenticated;

-- 2) Remove any policy that might be too broad and includes DELETE
-- (Your list shows: "Agency members can manage client users" ALL authenticated)
drop policy if exists "Agency members can manage client users" on public.client_users;

-- Keep/replace the SELECT policy (optional).
-- If you already have "Agency members can view client users", leave it.
-- Otherwise create a safe one:
drop policy if exists "Agency members can view client users" on public.client_users;

create policy "Agency members can view client users"
on public.client_users
for select
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.user_id = auth.uid()
      and am.agency_id = public.client_users.agency_id
  )
);

-- 3) Create the DELETE policy: ONLY admin/manager (and owner by default)
drop policy if exists "Agency admins/managers can delete client users" on public.client_users;

create policy "Agency admins/managers can delete client users"
on public.client_users
for delete
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.user_id = auth.uid()
      and am.agency_id = public.client_users.agency_id
      and am.role in ('admin', 'manager', 'owner')  -- remove 'owner' if you truly want to block owner
  )
);

-- 4) (Optional but recommended) Re-add INSERT/UPDATE policies
-- so your app doesn't lose create/edit capability after removing the ALL policy.
-- If you already have fine-grained insert/update policies, delete this block.

drop policy if exists "Agency admins/managers can insert client users" on public.client_users;
create policy "Agency admins/managers can insert client users"
on public.client_users
for insert
to authenticated
with check (
  exists (
    select 1
    from public.agency_members am
    where am.user_id = auth.uid()
      and am.agency_id = public.client_users.agency_id
      and am.role in ('admin', 'manager', 'owner')
  )
);

drop policy if exists "Agency admins/managers can update client users" on public.client_users;
create policy "Agency admins/managers can update client users"
on public.client_users
for update
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.user_id = auth.uid()
      and am.agency_id = public.client_users.agency_id
      and am.role in ('admin', 'manager', 'owner')
  )
)
with check (
  exists (
    select 1
    from public.agency_members am
    where am.user_id = auth.uid()
      and am.agency_id = public.client_users.agency_id
      and am.role in ('admin', 'manager', 'owner')
  )
);

commit;
