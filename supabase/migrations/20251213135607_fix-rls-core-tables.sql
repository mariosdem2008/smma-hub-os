-- 1) Grants (so PostgREST can even touch the tables)
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on table
  public.profiles,
  public.agencies,
  public.agency_members,
  public.subscriptions
to authenticated;

-- If you use uuid defaults / sequences, keep this:
grant usage, select on all sequences in schema public to authenticated;

-- 2) RLS
alter table public.profiles enable row level security;
alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;
alter table public.subscriptions enable row level security;

-- PROFILES: user reads/updates self
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- AGENCIES: owner reads their agency
drop policy if exists agencies_select_own on public.agencies;
create policy agencies_select_own
on public.agencies for select
to authenticated
using (user_id = auth.uid());

-- AGENCY_MEMBERS: user can read memberships of agencies they're in
drop policy if exists agency_members_select_if_in_agency on public.agency_members;
create policy agency_members_select_if_in_agency
on public.agency_members for select
to authenticated
using (
  exists (
    select 1 from public.agency_members am
    where am.agency_id = agency_members.agency_id
      and am.user_id = auth.uid()
  )
);

-- SUBSCRIPTIONS: user reads/inserts own subscription
drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own
on public.subscriptions for select
to authenticated
using (user_id = auth.uid());

drop policy if exists subscriptions_insert_own on public.subscriptions;
create policy subscriptions_insert_own
on public.subscriptions for insert
to authenticated
with check (user_id = auth.uid());
