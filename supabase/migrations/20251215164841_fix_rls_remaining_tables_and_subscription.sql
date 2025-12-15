-- 0) Schema usage (harmless)
grant usage on schema public to anon, authenticated;

-- 1) GRANTS (fixes "permission denied" at the PostgREST layer)
-- Only grant to authenticated by default (safer). Add anon only if you truly need public read.
grant select, insert, update, delete on table public.subscriptions to authenticated;
grant select, insert, update, delete on table public.client_branding to authenticated;
grant select, insert, update, delete on table public.assets to authenticated;
grant select, insert, update, delete on table public.social_post_metrics to authenticated;

-- If these exist and you still query them from the client, keep them too:
grant select, insert, update, delete on table public.notifications to authenticated;
grant select, insert, update, delete on table public.clients to authenticated;

-- sequences (safe)
grant usage, select on all sequences in schema public to authenticated;

-- 2) Helper: agency membership
create or replace function public.is_member_of_agency(_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agency_members am
    where am.agency_id = _agency_id
      and am.user_id = auth.uid()
  );
$$;

alter function public.is_member_of_agency(uuid) owner to postgres;
grant execute on function public.is_member_of_agency(uuid) to authenticated;

-- 3) Helper: client membership via clients.agency_id
create or replace function public.is_member_of_client(_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clients c
    join public.agency_members am on am.agency_id = c.agency_id
    where c.id = _client_id
      and am.user_id = auth.uid()
  );
$$;

alter function public.is_member_of_client(uuid) owner to postgres;
grant execute on function public.is_member_of_client(uuid) to authenticated;

-- 4) Ensure RLS is enabled
alter table public.subscriptions enable row level security;
alter table public.client_branding enable row level security;
alter table public.assets enable row level security;
alter table public.social_post_metrics enable row level security;

-- (Optional if not already enabled)
alter table public.clients enable row level security;
alter table public.notifications enable row level security;

-- 5) SUBSCRIPTIONS (this often fixes Edge Function crashes when it reads/writes this table)
drop policy if exists "subscriptions_select_own" on public.subscriptions;
drop policy if exists "subscriptions_insert_own" on public.subscriptions;
drop policy if exists "subscriptions_update_own" on public.subscriptions;
drop policy if exists "subscriptions_delete_own" on public.subscriptions;

create policy "subscriptions_select_own"
on public.subscriptions
for select
to authenticated
using (user_id = auth.uid());

create policy "subscriptions_insert_own"
on public.subscriptions
for insert
to authenticated
with check (user_id = auth.uid());

create policy "subscriptions_update_own"
on public.subscriptions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "subscriptions_delete_own"
on public.subscriptions
for delete
to authenticated
using (user_id = auth.uid());

-- 6) CLIENT BRANDING (your queries filter by client_id=eq...)
drop policy if exists "client_branding_select_client_members" on public.client_branding;
drop policy if exists "client_branding_insert_client_members" on public.client_branding;
drop policy if exists "client_branding_update_client_members" on public.client_branding;
drop policy if exists "client_branding_delete_client_members" on public.client_branding;

create policy "client_branding_select_client_members"
on public.client_branding
for select
to authenticated
using (public.is_member_of_client(client_id));

create policy "client_branding_insert_client_members"
on public.client_branding
for insert
to authenticated
with check (public.is_member_of_client(client_id));

create policy "client_branding_update_client_members"
on public.client_branding
for update
to authenticated
using (public.is_member_of_client(client_id))
with check (public.is_member_of_client(client_id));

create policy "client_branding_delete_client_members"
on public.client_branding
for delete
to authenticated
using (public.is_member_of_client(client_id));

-- 7) ASSETS (your queries filter by client_id + status)
drop policy if exists "assets_select_client_members" on public.assets;
drop policy if exists "assets_insert_client_members" on public.assets;
drop policy if exists "assets_update_client_members" on public.assets;
drop policy if exists "assets_delete_client_members" on public.assets;

create policy "assets_select_client_members"
on public.assets
for select
to authenticated
using (public.is_member_of_client(client_id));

create policy "assets_insert_client_members"
on public.assets
for insert
to authenticated
with check (public.is_member_of_client(client_id));

create policy "assets_update_client_members"
on public.assets
for update
to authenticated
using (public.is_member_of_client(client_id))
with check (public.is_member_of_client(client_id));

create policy "assets_delete_client_members"
on public.assets
for delete
to authenticated
using (public.is_member_of_client(client_id));

-- 8) SOCIAL POST METRICS (your dashboard analytics fetch)
drop policy if exists "social_post_metrics_select_client_members" on public.social_post_metrics;
drop policy if exists "social_post_metrics_insert_client_members" on public.social_post_metrics;
drop policy if exists "social_post_metrics_update_client_members" on public.social_post_metrics;
drop policy if exists "social_post_metrics_delete_client_members" on public.social_post_metrics;

create policy "social_post_metrics_select_client_members"
on public.social_post_metrics
for select
to authenticated
using (public.is_member_of_client(client_id));

create policy "social_post_metrics_insert_client_members"
on public.social_post_metrics
for insert
to authenticated
with check (public.is_member_of_client(client_id));

create policy "social_post_metrics_update_client_members"
on public.social_post_metrics
for update
to authenticated
using (public.is_member_of_client(client_id))
with check (public.is_member_of_client(client_id));

create policy "social_post_metrics_delete_client_members"
on public.social_post_metrics
for delete
to authenticated
using (public.is_member_of_client(client_id));
