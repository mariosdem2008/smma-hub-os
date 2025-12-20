-- Fix RLS for subscriptions and agency_members to prevent 403s for signed-in users

-- subscriptions: allow users to read/update/insert their own row
alter table if exists public.subscriptions enable row level security;

drop policy if exists "subscriptions_owner_all" on public.subscriptions;
create policy "subscriptions_owner_all"
  on public.subscriptions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- agency_members: allow users to read their membership row
alter table if exists public.agency_members enable row level security;

drop policy if exists "agency_members_self_select" on public.agency_members;
create policy "agency_members_self_select"
  on public.agency_members
  for select
  using (user_id = auth.uid());
