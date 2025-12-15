-- 0) Make sure table owner can bypass RLS inside SECURITY DEFINER functions
-- (IMPORTANT: if FORCE is enabled, SECURITY DEFINER won't help)
alter table public.agency_members no force row level security;

-- 1) Drop ALL existing policies on agency_members (prevents hidden recursion)
do $$
declare r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'agency_members'
  loop
    execute format('drop policy if exists %I on public.agency_members;', r.policyname);
  end loop;
end $$;

-- 2) Re-enable RLS
alter table public.agency_members enable row level security;

-- 3) Minimal, non-recursive policies (ONLY SELF)
create policy agency_members_select_self
on public.agency_members
for select
to authenticated
using (user_id = auth.uid());

create policy agency_members_insert_self
on public.agency_members
for insert
to authenticated
with check (user_id = auth.uid());

create policy agency_members_update_self
on public.agency_members
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Optional: deny deletes by default (no policy = no delete)
