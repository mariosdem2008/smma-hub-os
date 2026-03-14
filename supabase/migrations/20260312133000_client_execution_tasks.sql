-- Execution task layer derived from operations checklist + enrichment queue

create table if not exists public.client_execution_tasks (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  checklist_item_id uuid references public.client_operations_checklist_items(id) on delete set null,
  queue_item_id uuid references public.client_enrichment_queue(id) on delete set null,
  task_key text not null,
  source_kind text not null
    check (source_kind in ('operations_checklist', 'enrichment_queue', 'manual')),
  title text not null,
  description text,
  owner text not null
    check (owner in ('client', 'agency', 'shared', 'system')),
  status text not null default 'todo'
    check (status in ('todo', 'waiting_on_client', 'in_progress', 'blocked', 'done', 'cancelled')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  due_at timestamptz,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, task_key)
);

create index if not exists idx_client_execution_tasks_client
  on public.client_execution_tasks (client_id, status, priority, created_at desc);

create index if not exists idx_client_execution_tasks_agency
  on public.client_execution_tasks (agency_id, updated_at desc);

alter table public.client_execution_tasks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'client_execution_tasks'
      and policyname = 'client_execution_tasks_select'
  ) then
    execute $policy$
      create policy "client_execution_tasks_select"
      on public.client_execution_tasks
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = client_execution_tasks.agency_id
            and am.user_id = auth.uid()
        )
      );
    $policy$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'client_execution_tasks'
      and policyname = 'client_execution_tasks_admin_write'
  ) then
    execute $policy$
      create policy "client_execution_tasks_admin_write"
      on public.client_execution_tasks
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = client_execution_tasks.agency_id
            and am.user_id = auth.uid()
            and am.role in ('owner', 'admin')
        )
      )
      with check (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = client_execution_tasks.agency_id
            and am.user_id = auth.uid()
            and am.role in ('owner', 'admin')
        )
      );
    $policy$;
  end if;
end $$;

drop trigger if exists client_execution_tasks_updated_at on public.client_execution_tasks;
create trigger client_execution_tasks_updated_at
  before update on public.client_execution_tasks
  for each row
  execute function public.update_updated_at_column();

grant select, insert, update, delete on table public.client_execution_tasks to authenticated;
grant all on table public.client_execution_tasks to service_role;

create or replace function public.refresh_client_execution_tasks(
  p_client_id uuid,
  p_reason text default 'sync'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client record;
  v_checklist record;
  v_queue record;
  v_active_keys text[] := array[]::text[];
  v_synced integer := 0;
  v_cancelled integer := 0;
  v_status text;
  v_priority text;
begin
  select c.id, c.agency_id
  into v_client
  from public.clients c
  where c.id = p_client_id;

  if v_client.id is null then
    return jsonb_build_object('ok', false, 'reason', 'client_not_found');
  end if;

  for v_checklist in
    select *
    from public.client_operations_checklist_items
    where client_id = p_client_id
      and status <> 'done'
    order by created_at asc
  loop
    v_active_keys := array_append(v_active_keys, 'checklist:' || v_checklist.item_key);
    v_priority := case
      when v_checklist.priority = 'high' and v_checklist.status = 'blocked' then 'urgent'
      when v_checklist.priority = 'high' then 'high'
      else v_checklist.priority
    end;

    insert into public.client_execution_tasks (
      agency_id,
      client_id,
      checklist_item_id,
      task_key,
      source_kind,
      title,
      description,
      owner,
      status,
      priority,
      due_at,
      resolved_at,
      metadata
    )
    values (
      v_client.agency_id,
      p_client_id,
      v_checklist.id,
      'checklist:' || v_checklist.item_key,
      'operations_checklist',
      v_checklist.title,
      v_checklist.description,
      v_checklist.owner,
      v_checklist.status,
      v_priority,
      v_checklist.due_at,
      case when v_checklist.status = 'done' then coalesce(v_checklist.resolved_at, now()) else null end,
      jsonb_build_object(
        'reason', p_reason,
        'section_key', v_checklist.section_key,
        'checklist_item_id', v_checklist.id
      )
    )
    on conflict (client_id, task_key) do update set
      agency_id = excluded.agency_id,
      checklist_item_id = excluded.checklist_item_id,
      title = excluded.title,
      description = excluded.description,
      owner = excluded.owner,
      status = case
        when client_execution_tasks.status = 'done' then client_execution_tasks.status
        else excluded.status
      end,
      priority = excluded.priority,
      due_at = coalesce(client_execution_tasks.due_at, excluded.due_at),
      resolved_at = case
        when client_execution_tasks.status = 'done' then coalesce(client_execution_tasks.resolved_at, now())
        else null
      end,
      metadata = client_execution_tasks.metadata || excluded.metadata,
      updated_at = now();

    v_synced := v_synced + 1;
  end loop;

  for v_queue in
    select *
    from public.client_enrichment_queue
    where client_id = p_client_id
      and status in ('queued', 'ready', 'in_progress')
    order by created_at desc
  loop
    v_active_keys := array_append(v_active_keys, 'queue:' || v_queue.source_kind || ':' || v_queue.source_key);
    v_status := case
      when v_queue.status = 'in_progress' then 'in_progress'
      when v_queue.owner = 'client' then 'waiting_on_client'
      when v_queue.source_kind = 'strategy_blocker' and v_queue.priority = 'high' then 'blocked'
      else 'todo'
    end;
    v_priority := case
      when v_queue.priority = 'high' and v_queue.source_kind = 'strategy_blocker' then 'urgent'
      else v_queue.priority
    end;

    insert into public.client_execution_tasks (
      agency_id,
      client_id,
      queue_item_id,
      task_key,
      source_kind,
      title,
      description,
      owner,
      status,
      priority,
      due_at,
      resolved_at,
      metadata
    )
    values (
      v_client.agency_id,
      p_client_id,
      v_queue.id,
      'queue:' || v_queue.source_kind || ':' || v_queue.source_key,
      'enrichment_queue',
      v_queue.title,
      coalesce(v_queue.rationale, v_queue.prompt),
      v_queue.owner,
      v_status,
      v_priority,
      null,
      case when v_queue.status in ('resolved', 'dismissed') then coalesce(v_queue.resolved_at, now()) else null end,
      coalesce(v_queue.metadata, '{}'::jsonb) || jsonb_build_object(
        'reason', p_reason,
        'queue_item_id', v_queue.id,
        'prompt', v_queue.prompt,
        'stage', v_queue.stage
      )
    )
    on conflict (client_id, task_key) do update set
      agency_id = excluded.agency_id,
      queue_item_id = excluded.queue_item_id,
      title = excluded.title,
      description = excluded.description,
      owner = excluded.owner,
      status = case
        when client_execution_tasks.status = 'done' then client_execution_tasks.status
        else excluded.status
      end,
      priority = excluded.priority,
      metadata = client_execution_tasks.metadata || excluded.metadata,
      updated_at = now();

    v_synced := v_synced + 1;
  end loop;

  update public.client_execution_tasks
  set
    status = case when status = 'done' then status else 'cancelled' end,
    resolved_at = case when status = 'done' then resolved_at else now() end,
    updated_at = now()
  where client_id = p_client_id
    and source_kind in ('operations_checklist', 'enrichment_queue')
    and not (task_key = any(v_active_keys))
    and status <> 'cancelled';

  get diagnostics v_cancelled = row_count;

  return jsonb_build_object(
    'ok', true,
    'client_id', p_client_id,
    'reason', p_reason,
    'synced', v_synced,
    'cancelled', v_cancelled,
    'active_tasks', (
      select count(*)
      from public.client_execution_tasks cet
      where cet.client_id = p_client_id
        and cet.status in ('todo', 'waiting_on_client', 'in_progress', 'blocked')
    )
  );
end;
$$;

revoke all on function public.refresh_client_execution_tasks(uuid, text) from public;
grant execute on function public.refresh_client_execution_tasks(uuid, text) to authenticated;
grant execute on function public.refresh_client_execution_tasks(uuid, text) to service_role;

create or replace function public.update_client_execution_task(
  p_task_id uuid,
  p_status text default null,
  p_owner text default null,
  p_due_at timestamptz default null,
  p_clear_due_at boolean default false
)
returns public.client_execution_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.client_execution_tasks;
  v_next_status text;
begin
  if p_status is not null and p_status not in ('todo', 'waiting_on_client', 'in_progress', 'blocked', 'done', 'cancelled') then
    raise exception 'invalid_task_status';
  end if;

  if p_owner is not null and p_owner not in ('client', 'agency', 'shared', 'system') then
    raise exception 'invalid_task_owner';
  end if;

  update public.client_execution_tasks
  set
    status = coalesce(p_status, status),
    owner = coalesce(p_owner, owner),
    due_at = case when p_clear_due_at then null when p_due_at is null then due_at else p_due_at end,
    resolved_at = case when coalesce(p_status, status) = 'done' then now() when p_status = 'cancelled' then now() else null end,
    updated_at = now()
  where id = p_task_id
  returning * into v_task;

  if v_task.id is null then
    raise exception 'task_not_found';
  end if;

  if v_task.source_kind = 'operations_checklist' and v_task.checklist_item_id is not null then
    update public.client_operations_checklist_items
    set
      owner = case when coalesce(p_owner, v_task.owner) in ('client', 'agency', 'shared') then coalesce(p_owner, v_task.owner) else owner end,
      due_at = case when p_clear_due_at then null when p_due_at is null then due_at else p_due_at end,
      status = case
        when coalesce(p_status, v_task.status) = 'cancelled' then status
        else coalesce(p_status, v_task.status)
      end,
      resolved_at = case when coalesce(p_status, v_task.status) = 'done' then now() else null end,
      updated_at = now()
    where id = v_task.checklist_item_id;
  elsif v_task.source_kind = 'enrichment_queue' and v_task.queue_item_id is not null then
    v_next_status := case
      when coalesce(p_status, v_task.status) = 'done' then 'resolved'
      when coalesce(p_status, v_task.status) = 'cancelled' then 'dismissed'
      when coalesce(p_status, v_task.status) = 'in_progress' then 'in_progress'
      else 'ready'
    end;

    update public.client_enrichment_queue
    set
      owner = coalesce(p_owner, owner),
      status = v_next_status,
      resolved_at = case when v_next_status in ('resolved', 'dismissed') then now() else null end,
      updated_at = now()
    where id = v_task.queue_item_id;
  end if;

  select *
  into v_task
  from public.client_execution_tasks
  where id = p_task_id;

  return v_task;
end;
$$;

revoke all on function public.update_client_execution_task(uuid, text, text, timestamptz, boolean) from public;
grant execute on function public.update_client_execution_task(uuid, text, text, timestamptz, boolean) to authenticated;
grant execute on function public.update_client_execution_task(uuid, text, text, timestamptz, boolean) to service_role;

with existing_clients as (
  select id
  from public.clients
)
select public.refresh_client_execution_tasks(id, 'migration_backfill')
from existing_clients;
