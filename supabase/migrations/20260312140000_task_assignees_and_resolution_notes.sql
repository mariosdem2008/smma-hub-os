-- Real assignees and closure notes for execution tasks

alter table public.client_execution_tasks
  add column if not exists assignee_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists resolution_note text;

create index if not exists idx_client_execution_tasks_assignee
  on public.client_execution_tasks (assignee_user_id, status, updated_at desc);

create or replace function public.update_client_execution_task(
  p_task_id uuid,
  p_status text default null,
  p_owner text default null,
  p_due_at timestamptz default null,
  p_clear_due_at boolean default false,
  p_assignee_user_id uuid default null,
  p_clear_assignee boolean default false,
  p_resolution_note text default null
)
returns public.client_execution_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.client_execution_tasks;
  v_prev public.client_execution_tasks;
  v_next_status text;
begin
  if p_status is not null and p_status not in ('todo', 'waiting_on_client', 'in_progress', 'blocked', 'done', 'cancelled') then
    raise exception 'invalid_task_status';
  end if;

  if p_owner is not null and p_owner not in ('client', 'agency', 'shared', 'system') then
    raise exception 'invalid_task_owner';
  end if;

  select *
  into v_prev
  from public.client_execution_tasks
  where id = p_task_id;

  update public.client_execution_tasks
  set
    status = coalesce(p_status, status),
    owner = coalesce(p_owner, owner),
    due_at = case when p_clear_due_at then null when p_due_at is null then due_at else p_due_at end,
    assignee_user_id = case when p_clear_assignee then null when p_assignee_user_id is null then assignee_user_id else p_assignee_user_id end,
    resolution_note = case
      when p_resolution_note is not null then nullif(btrim(p_resolution_note), '')
      when coalesce(p_status, status) not in ('done', 'cancelled') then null
      else resolution_note
    end,
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

  insert into public.client_operation_events (
    agency_id,
    client_id,
    execution_task_id,
    checklist_item_id,
    queue_item_id,
    event_kind,
    actor_kind,
    payload
  )
  values (
    v_task.agency_id,
    v_task.client_id,
    v_task.id,
    v_task.checklist_item_id,
    v_task.queue_item_id,
    case
      when v_task.status = 'done' then 'task_resolved'
      when v_task.status = 'cancelled' then 'task_cancelled'
      else 'task_updated'
    end,
    'agency',
    jsonb_build_object(
      'title', v_task.title,
      'previous_status', v_prev.status,
      'next_status', v_task.status,
      'previous_owner', v_prev.owner,
      'next_owner', v_task.owner,
      'previous_due_at', v_prev.due_at,
      'next_due_at', v_task.due_at,
      'previous_assignee_user_id', v_prev.assignee_user_id,
      'next_assignee_user_id', v_task.assignee_user_id,
      'resolution_note', v_task.resolution_note
    )
  );

  return v_task;
end;
$$;

revoke all on function public.update_client_execution_task(uuid, text, text, timestamptz, boolean, uuid, boolean, text) from public;
grant execute on function public.update_client_execution_task(uuid, text, text, timestamptz, boolean, uuid, boolean, text) to authenticated;
grant execute on function public.update_client_execution_task(uuid, text, text, timestamptz, boolean, uuid, boolean, text) to service_role;
