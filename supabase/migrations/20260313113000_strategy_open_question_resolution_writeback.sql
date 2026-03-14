-- Write strategy open-question task resolutions back into strategy_modules

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
  v_queue record;
  v_strategy_module public.strategy_modules;
  v_strategy_module_key public.strategy_module;
  v_open_questions jsonb := '[]'::jsonb;
  v_resolved_questions jsonb := '[]'::jsonb;
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
    select *
    into v_queue
    from public.client_enrichment_queue
    where id = v_task.queue_item_id;

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
      updated_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || case
        when coalesce(p_status, v_task.status) in ('done', 'cancelled') then jsonb_build_object(
          'resolution_note', coalesce(nullif(btrim(p_resolution_note), ''), resolution_note),
          'resolved_from_task_id', v_task.id
        )
        else '{}'::jsonb
      end
    where id = v_task.queue_item_id;

    if coalesce(p_status, v_task.status) in ('done', 'cancelled') then
      insert into public.client_enrichment_resolutions (
        agency_id,
        client_id,
        source_kind,
        source_key,
        resolution_status,
        source_snapshot_hash,
        resolution_note,
        metadata
      )
      values (
        v_task.agency_id,
        v_task.client_id,
        v_queue.source_kind,
        v_queue.source_key,
        case when coalesce(p_status, v_task.status) = 'done' then 'resolved' else 'dismissed' end,
        coalesce(v_queue.metadata->>'source_snapshot_hash', null),
        coalesce(nullif(btrim(p_resolution_note), ''), v_task.resolution_note),
        jsonb_build_object('queue_item_id', v_queue.id, 'task_id', v_task.id)
      )
      on conflict (client_id, source_kind, source_key) do update set
        resolution_status = excluded.resolution_status,
        source_snapshot_hash = excluded.source_snapshot_hash,
        resolution_note = excluded.resolution_note,
        metadata = client_enrichment_resolutions.metadata || excluded.metadata,
        updated_at = now();
    else
      delete from public.client_enrichment_resolutions
      where client_id = v_task.client_id
        and source_kind = v_queue.source_kind
        and source_key = v_queue.source_key;
    end if;

    if v_queue.source_kind = 'strategy_open_question' then
      begin
        v_strategy_module_key := coalesce(
          nullif(v_queue.metadata->>'module', ''),
          nullif(split_part(v_queue.source_key, ':', 2), '')
        )::public.strategy_module;
      exception
        when others then
          v_strategy_module_key := null;
      end;

      if v_strategy_module_key is not null then
        select *
        into v_strategy_module
        from public.strategy_modules sm
        where sm.client_id = v_task.client_id
          and sm.module = v_strategy_module_key
          and (v_queue.strategy_id is null or sm.strategy_id = v_queue.strategy_id)
        order by sm.updated_at desc
        limit 1;

        if v_strategy_module.id is not null and nullif(btrim(v_queue.prompt), '') is not null then
          if coalesce(p_status, v_task.status) = 'done' and coalesce(v_prev.status, '') <> 'done' then
            select coalesce(jsonb_agg(to_jsonb(value)), '[]'::jsonb)
            into v_open_questions
            from jsonb_array_elements_text(coalesce(v_strategy_module.content_json->'open_questions', '[]'::jsonb)) as value
            where value <> v_queue.prompt;

            select coalesce(jsonb_agg(value), '[]'::jsonb)
            into v_resolved_questions
            from (
              select value
              from jsonb_array_elements(coalesce(v_strategy_module.content_json->'resolved_open_questions', '[]'::jsonb))
              union all
              select jsonb_build_object(
                'question', v_queue.prompt,
                'resolved_at', now(),
                'resolution_note', coalesce(nullif(btrim(p_resolution_note), ''), v_task.resolution_note),
                'resolved_from_task_id', v_task.id,
                'queue_item_id', v_queue.id
              )
            ) as entries(value);

            update public.strategy_modules
            set
              content_json = jsonb_set(
                jsonb_set(coalesce(content_json, '{}'::jsonb), '{open_questions}', v_open_questions, true),
                '{resolved_open_questions}',
                v_resolved_questions,
                true
              ),
              updated_at = now()
            where id = v_strategy_module.id;

            insert into public.strategy_history (
              client_id,
              strategy_id,
              module_id,
              module,
              event_type,
              event_data,
              actor_id
            )
            values (
              v_strategy_module.client_id,
              v_strategy_module.strategy_id,
              v_strategy_module.id,
              v_strategy_module.module,
              'updated',
              jsonb_build_object(
                'source', 'execution_task_resolution',
                'action', 'resolved_open_question',
                'question', v_queue.prompt,
                'task_id', v_task.id,
                'queue_item_id', v_queue.id,
                'resolution_note', coalesce(nullif(btrim(p_resolution_note), ''), v_task.resolution_note)
              ),
              auth.uid()
            );
          elsif coalesce(v_prev.status, '') = 'done' and coalesce(p_status, v_task.status) not in ('done', 'cancelled') then
            select coalesce(jsonb_agg(to_jsonb(value)), '[]'::jsonb)
            into v_open_questions
            from (
              select value
              from jsonb_array_elements_text(coalesce(v_strategy_module.content_json->'open_questions', '[]'::jsonb)) as value
              union
              select v_queue.prompt
            ) as open_values(value);

            select coalesce(jsonb_agg(value), '[]'::jsonb)
            into v_resolved_questions
            from jsonb_array_elements(coalesce(v_strategy_module.content_json->'resolved_open_questions', '[]'::jsonb)) as value
            where coalesce(value->>'question', '') <> v_queue.prompt
              and coalesce(value->>'resolved_from_task_id', '') <> v_task.id::text;

            update public.strategy_modules
            set
              content_json = jsonb_set(
                jsonb_set(coalesce(content_json, '{}'::jsonb), '{open_questions}', v_open_questions, true),
                '{resolved_open_questions}',
                v_resolved_questions,
                true
              ),
              updated_at = now()
            where id = v_strategy_module.id;

            insert into public.strategy_history (
              client_id,
              strategy_id,
              module_id,
              module,
              event_type,
              event_data,
              actor_id
            )
            values (
              v_strategy_module.client_id,
              v_strategy_module.strategy_id,
              v_strategy_module.id,
              v_strategy_module.module,
              'updated',
              jsonb_build_object(
                'source', 'execution_task_resolution',
                'action', 'reopened_open_question',
                'question', v_queue.prompt,
                'task_id', v_task.id,
                'queue_item_id', v_queue.id
              ),
              auth.uid()
            );
          end if;
        end if;
      end if;
    end if;
  end if;

  insert into public.client_operation_events (
    agency_id, client_id, execution_task_id, checklist_item_id, queue_item_id, event_kind, actor_kind, payload
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
