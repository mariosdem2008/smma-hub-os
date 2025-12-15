-- 0) Schema usage (safe)
grant usage on schema public to anon, authenticated;

-- 1) GRANTS required so policies/joins can evaluate without "permission denied"
-- (This is the exact cause of your error: policy evaluation touching client_users)
grant select on table public.client_users to authenticated;

-- Also ensure the tables you're querying are selectable
grant select on table public.social_post_metrics to authenticated;
grant select on table public.tasks to authenticated;

-- If your app ever inserts/updates these (optional but safe)
grant insert, update, delete on table public.tasks to authenticated;
grant insert, update, delete on table public.social_post_metrics to authenticated;

-- sequences (safe blanket)
grant usage, select on all sequences in schema public to authenticated;
grant usage, select on all sequences in schema public to anon;

-- 2) SECURITY DEFINER helper: user can access a client if they are a member of the client's agency
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
    join public.agency_members am
      on am.agency_id = c.agency_id
    where c.id = _client_id
      and am.user_id = auth.uid()
  );
$$;

alter function public.is_member_of_client(uuid) owner to postgres;
grant execute on function public.is_member_of_client(uuid) to anon, authenticated;

-- 3) Ensure RLS is enabled (safe)
alter table public.social_post_metrics enable row level security;
alter table public.tasks enable row level security;

-- 4) Policies
-- SOCIAL POST METRICS: only members of the client's agency can read rows
drop policy if exists "social_post_metrics_select_client_members_v2" on public.social_post_metrics;
create policy "social_post_metrics_select_client_members_v2"
on public.social_post_metrics
for select
to authenticated
using (public.is_member_of_client(client_id));

-- TASKS: handle both common schemas (client_id OR agency_id)
do $$
declare has_client_id boolean;
declare has_agency_id boolean;
begin
  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tasks' and column_name='client_id'
  ) into has_client_id;

  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tasks' and column_name='agency_id'
  ) into has_agency_id;

  -- drop old v2 policy name if present (safe)
  execute 'drop policy if exists "tasks_select_scope_v2" on public.tasks';

  if has_client_id then
    execute $p$
      create policy "tasks_select_scope_v2"
      on public.tasks
      for select
      to authenticated
      using (public.is_member_of_client(client_id));
    $p$;
  elsif has_agency_id then
    -- relies on your existing public.is_member_of_agency(uuid)
    execute $p$
      create policy "tasks_select_scope_v2"
      on public.tasks
      for select
      to authenticated
      using (public.is_member_of_agency(agency_id));
    $p$;
  end if;
end $$;
