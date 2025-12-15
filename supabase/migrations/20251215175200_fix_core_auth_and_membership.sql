-- 0) Base schema access
grant usage on schema public to anon, authenticated;

-- 1) Ensure authenticated can SELECT the tables your app hits immediately
grant select on public.agencies to authenticated;
grant select on public.agency_members to authenticated;
grant select on public.profiles to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.clients to authenticated;

-- 2) Performance indexes (prevents “infinite loading” / long pending)
create index if not exists idx_agencies_user_id on public.agencies (user_id);
create index if not exists idx_agency_members_user_id on public.agency_members (user_id);
create index if not exists idx_agency_members_agency_id on public.agency_members (agency_id);
create index if not exists idx_clients_agency_id on public.clients (agency_id);

-- 3) SECURITY DEFINER helpers (fast + avoids policy touching tables without grants)
create or replace function public.is_member_of_agency(_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agencies a
    where a.id = _agency_id
      and a.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.agency_members am
    where am.agency_id = _agency_id
      and am.user_id = auth.uid()
  );
$$;

alter function public.is_member_of_agency(uuid) owner to postgres;
grant execute on function public.is_member_of_agency(uuid) to anon, authenticated;

-- 4) RLS: make the “first queries after login” always work
-- agencies: you can read your own agency (as owner) + agencies you belong to
alter table public.agencies enable row level security;

drop policy if exists agencies_select_own on public.agencies;
create policy agencies_select_own
on public.agencies
for select
to authenticated
using (public.is_member_of_agency(id));

-- agency_members: you can read members of agencies you belong to (needed for dashboard/team)
alter table public.agency_members enable row level security;

drop policy if exists agency_members_select_self on public.agency_members;
create policy agency_members_select_self
on public.agency_members
for select
to authenticated
using (public.is_member_of_agency(agency_id));

-- profiles: allow reading your own profile (common on login)
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = auth.uid());

-- subscriptions: allow reading your own subscription (your app checks it early)
alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own
on public.subscriptions
for select
to authenticated
using (user_id = auth.uid());

-- clients: allow selecting clients for agencies you belong to (dashboard depends on it)
alter table public.clients enable row level security;

drop policy if exists clients_select_agency_members_v2 on public.clients;
create policy clients_select_agency_members_v2
on public.clients
for select
to authenticated
using (public.is_member_of_agency(agency_id));
