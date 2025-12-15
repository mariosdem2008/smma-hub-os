-- 0) Schema usage
grant usage on schema public to anon, authenticated;

-- 1) GRANTS (fixes 42501 "permission denied")
grant select on table public.clients to anon, authenticated;
grant insert, update, delete on table public.clients to authenticated;

grant select on table public.notifications to anon, authenticated;
grant insert, update, delete on table public.notifications to authenticated;

-- sequences (safe)
grant usage, select on all sequences in schema public to authenticated;
grant usage, select on all sequences in schema public to anon;

-- 2) Helper for agency membership (safe + reusable)
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
grant execute on function public.is_member_of_agency(uuid) to anon, authenticated;

-- 3) Clients SELECT policy (no pg_policies check; idempotent)
drop policy if exists "clients_select_agency_members_v2" on public.clients;

create policy "clients_select_agency_members_v2"
on public.clients
for select
to authenticated
using (public.is_member_of_agency(agency_id));

-- 4) Notifications policies ONLY if the columns exist (safe)
do $$
declare has_user_id boolean;
declare has_agency_id boolean;
begin
  select exists(
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='notifications'
      and column_name='user_id'
  ) into has_user_id;

  select exists(
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='notifications'
      and column_name='agency_id'
  ) into has_agency_id;

  if has_user_id then
    execute 'drop policy if exists "notifications_select_own_v2" on public.notifications';
    execute '
      create policy "notifications_select_own_v2"
      on public.notifications
      for select
      to authenticated
      using (user_id = auth.uid())
    ';
  end if;

  if has_agency_id then
    execute 'drop policy if exists "notifications_select_agency_v2" on public.notifications';
    execute '
      create policy "notifications_select_agency_v2"
      on public.notifications
      for select
      to authenticated
      using (public.is_member_of_agency(agency_id))
    ';
  end if;
end $$;
