-- 1) Allow authenticated to read user_roles (needed if any RLS policy references it)
grant usage on schema public to authenticated;
grant select on table public.user_roles to authenticated;

-- 2) If user_roles has RLS enabled, add a policy so reads don't get blocked.
-- (If RLS is NOT enabled on user_roles, this policy is harmless but optional.)
alter table public.user_roles enable row level security;

drop policy if exists "user_roles_read_own" on public.user_roles;
create policy "user_roles_read_own"
on public.user_roles
for select
to authenticated
using (
  user_id = auth.uid()
);
