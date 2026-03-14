-- Deeper drift signals + operational event history

create table if not exists public.client_operation_events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  execution_task_id uuid references public.client_execution_tasks(id) on delete set null,
  checklist_item_id uuid references public.client_operations_checklist_items(id) on delete set null,
  queue_item_id uuid references public.client_enrichment_queue(id) on delete set null,
  event_kind text not null
    check (event_kind in ('task_created', 'task_updated', 'task_resolved', 'task_cancelled', 'queue_refreshed', 'drift_detected')),
  actor_kind text not null default 'system'
    check (actor_kind in ('system', 'agency', 'client')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_operation_events_client
  on public.client_operation_events (client_id, created_at desc);

create index if not exists idx_client_operation_events_task
  on public.client_operation_events (execution_task_id, created_at desc);

alter table public.client_operation_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'client_operation_events'
      and policyname = 'client_operation_events_select'
  ) then
    execute $policy$
      create policy "client_operation_events_select"
      on public.client_operation_events
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = client_operation_events.agency_id
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
      and tablename = 'client_operation_events'
      and policyname = 'client_operation_events_admin_write'
  ) then
    execute $policy$
      create policy "client_operation_events_admin_write"
      on public.client_operation_events
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = client_operation_events.agency_id
            and am.user_id = auth.uid()
            and am.role in ('owner', 'admin')
        )
      )
      with check (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = client_operation_events.agency_id
            and am.user_id = auth.uid()
            and am.role in ('owner', 'admin')
        )
      );
    $policy$;
  end if;
end $$;

grant select, insert, update, delete on table public.client_operation_events to authenticated;
grant all on table public.client_operation_events to service_role;

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
  v_existing_id uuid;
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

    select id
    into v_existing_id
    from public.client_execution_tasks
    where client_id = p_client_id
      and task_key = 'checklist:' || v_checklist.item_key;

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

    if v_existing_id is null then
      insert into public.client_operation_events (
        agency_id,
        client_id,
        checklist_item_id,
        execution_task_id,
        event_kind,
        actor_kind,
        payload
      )
      select
        cet.agency_id,
        cet.client_id,
        cet.checklist_item_id,
        cet.id,
        'task_created',
        'system',
        jsonb_build_object('reason', p_reason, 'task_key', cet.task_key, 'source_kind', cet.source_kind)
      from public.client_execution_tasks cet
      where cet.client_id = p_client_id
        and cet.task_key = 'checklist:' || v_checklist.item_key;
    end if;

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

    select id
    into v_existing_id
    from public.client_execution_tasks
    where client_id = p_client_id
      and task_key = 'queue:' || v_queue.source_kind || ':' || v_queue.source_key;

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

    if v_existing_id is null then
      insert into public.client_operation_events (
        agency_id,
        client_id,
        queue_item_id,
        execution_task_id,
        event_kind,
        actor_kind,
        payload
      )
      select
        cet.agency_id,
        cet.client_id,
        cet.queue_item_id,
        cet.id,
        'task_created',
        'system',
        jsonb_build_object('reason', p_reason, 'task_key', cet.task_key, 'source_kind', cet.source_kind)
      from public.client_execution_tasks cet
      where cet.client_id = p_client_id
        and cet.task_key = 'queue:' || v_queue.source_kind || ':' || v_queue.source_key;
    end if;

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

create or replace function public.refresh_client_enrichment_queue(
  p_client_id uuid,
  p_reason text default 'manual_refresh'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client record;
  v_profile record;
  v_strategy record;
  v_module record;
  v_doc record;
  v_brain record;
  v_ops record;
  v_blocker jsonb;
  v_field text;
  v_question text;
  v_inserted integer := 0;
  v_active_items integer := 0;
begin
  select c.id, c.agency_id
  into v_client
  from public.clients c
  where c.id = p_client_id;

  if v_client.id is null then
    return jsonb_build_object('ok', false, 'reason', 'client_not_found');
  end if;

  delete from public.client_enrichment_queue
  where client_id = p_client_id
    and source_kind <> 'manual'
    and status in ('queued', 'ready', 'in_progress');

  select *
  into v_profile
  from public.client_onboarding_profiles cop
  where cop.client_id = p_client_id
  order by cop.updated_at desc
  limit 1;

  select *
  into v_brain
  from public.client_brains cb
  where cb.client_id = p_client_id
  order by cb.version desc, cb.updated_at desc
  limit 1;

  select *
  into v_ops
  from public.client_operations_setup cos
  where cos.client_id = p_client_id
  limit 1;

  if v_profile.client_id is not null then
    for v_field in
      select jsonb_array_elements_text(
        coalesce(v_profile.v5_meta->'staged_readiness'->'progressive_enrichment'->'missing', '[]'::jsonb)
      )
    loop
      insert into public.client_enrichment_queue (
        agency_id,
        client_id,
        source_kind,
        source_key,
        title,
        prompt,
        rationale,
        owner,
        priority,
        stage,
        status,
        metadata
      )
      values (
        v_client.agency_id,
        p_client_id,
        'onboarding_gap',
        'onboarding:' || v_field,
        public.client_onboarding_field_label(v_field),
        'Capture ' || lower(public.client_onboarding_field_label(v_field)) || ' so future strategy and AI outputs use better client context.',
        'Still missing from progressive enrichment after setup.',
        'shared',
        'medium',
        'progressive_enrichment',
        'queued',
        jsonb_build_object('field', v_field, 'reason', p_reason)
      )
      on conflict do nothing;
      v_inserted := v_inserted + 1;
    end loop;
  end if;

  select s.id, s.version_int, s.updated_at
  into v_strategy
  from public.strategies s
  where s.client_id = p_client_id
  order by s.version_int desc
  limit 1;

  if v_strategy.id is not null then
    for v_module in
      select module, content_json, blockers, updated_at
      from public.strategy_modules
      where strategy_id = v_strategy.id
      order by module
    loop
      for v_question in
        select jsonb_array_elements_text(coalesce(v_module.content_json->'open_questions', '[]'::jsonb))
      loop
        if nullif(btrim(v_question), '') is null then
          continue;
        end if;

        insert into public.client_enrichment_queue (
          agency_id,
          client_id,
          strategy_id,
          source_kind,
          source_key,
          title,
          prompt,
          rationale,
          owner,
          priority,
          stage,
          status,
          metadata
        )
        values (
          v_client.agency_id,
          p_client_id,
          v_strategy.id,
          'strategy_open_question',
          'open_question:' || v_module.module || ':' || md5(v_question),
          initcap(replace(v_module.module::text, '_', ' ')) || ' open question',
          v_question,
          'Generated from strategy module open questions.',
          'agency',
          'medium',
          'strategy',
          'ready',
          jsonb_build_object('module', v_module.module, 'reason', p_reason)
        )
        on conflict do nothing;
        v_inserted := v_inserted + 1;
      end loop;

      for v_blocker in
        select value
        from jsonb_array_elements(coalesce(v_module.blockers, '[]'::jsonb))
      loop
        insert into public.client_enrichment_queue (
          agency_id,
          client_id,
          strategy_id,
          source_kind,
          source_key,
          title,
          prompt,
          rationale,
          owner,
          priority,
          stage,
          status,
          metadata
        )
        values (
          v_client.agency_id,
          p_client_id,
          v_strategy.id,
          'strategy_blocker',
          'blocker:' || v_module.module || ':' || coalesce(v_blocker->>'code', md5(coalesce(v_blocker->>'message', 'blocker'))),
          initcap(replace(v_module.module::text, '_', ' ')) || ' blocker',
          coalesce(v_blocker->>'message', 'Strategy blocker needs review.'),
          'Generated from strategy module validation blockers.',
          'agency',
          case when coalesce(v_blocker->>'severity', 'med') = 'high' then 'high' else 'medium' end,
          'strategy',
          'ready',
          jsonb_build_object(
            'module', v_module.module,
            'code', v_blocker->>'code',
            'field_path', v_blocker->>'field_path',
            'severity', v_blocker->>'severity',
            'reason', p_reason
          )
        )
        on conflict do nothing;
        v_inserted := v_inserted + 1;
      end loop;
    end loop;

    select sd.id, sd.updated_at
    into v_doc
    from public.strategy_documents sd
    where sd.client_id = p_client_id
      and sd.is_active = true
    order by sd.updated_at desc
    limit 1;

    if v_doc.id is null or exists (
      select 1
      from public.strategy_modules sm
      where sm.strategy_id = v_strategy.id
        and sm.updated_at > coalesce(v_doc.updated_at, 'epoch'::timestamptz)
    ) then
      insert into public.client_enrichment_queue (
        agency_id,
        client_id,
        strategy_id,
        source_kind,
        source_key,
        title,
        prompt,
        rationale,
        owner,
        priority,
        stage,
        status,
        metadata
      )
      values (
        v_client.agency_id,
        p_client_id,
        v_strategy.id,
        'drift_signal',
        'drift:strategy_document_outdated',
        'Strategy document refresh',
        'The active strategy document is behind the latest module updates. Refresh the document so the client workspace stays aligned.',
        'Detected drift between module updates and the active strategy document.',
        'agency',
        'medium',
        'strategy',
        'ready',
        jsonb_build_object('reason', p_reason, 'signal', 'strategy_document_outdated')
      )
      on conflict do nothing;
      v_inserted := v_inserted + 1;
    end if;

    if v_profile.client_id is not null and v_doc.id is not null and v_profile.updated_at > v_doc.updated_at then
      insert into public.client_enrichment_queue (
        agency_id, client_id, strategy_id, source_kind, source_key, title, prompt, rationale, owner, priority, stage, status, metadata
      )
      values (
        v_client.agency_id,
        p_client_id,
        v_strategy.id,
        'drift_signal',
        'drift:onboarding_updated_after_strategy',
        'Reconcile onboarding updates',
        'The onboarding profile changed after the current strategy document. Review those changes and regenerate strategy outputs if they materially affect positioning or delivery.',
        'Detected newer onboarding data than the active strategy document.',
        'agency',
        'medium',
        'strategy',
        'ready',
        jsonb_build_object('reason', p_reason, 'signal', 'onboarding_updated_after_strategy', 'profile_updated_at', v_profile.updated_at)
      )
      on conflict do nothing;
      v_inserted := v_inserted + 1;
    end if;

    if v_brain.id is not null and v_doc.id is not null and v_brain.updated_at > v_doc.updated_at then
      insert into public.client_enrichment_queue (
        agency_id, client_id, strategy_id, source_kind, source_key, title, prompt, rationale, owner, priority, stage, status, metadata
      )
      values (
        v_client.agency_id,
        p_client_id,
        v_strategy.id,
        'drift_signal',
        'drift:client_brain_updated_after_strategy',
        'Reconcile client knowledge updates',
        'Client memory or approved knowledge changed after the active strategy document. Review whether strategy and execution assumptions are still current.',
        'Detected newer client brain context than the active strategy document.',
        'agency',
        'high',
        'strategy',
        'ready',
        jsonb_build_object('reason', p_reason, 'signal', 'client_brain_updated_after_strategy', 'brain_updated_at', v_brain.updated_at)
      )
      on conflict do nothing;
      v_inserted := v_inserted + 1;
    end if;

    if v_ops.client_id is not null and v_doc.id is not null and v_ops.updated_at > v_doc.updated_at then
      insert into public.client_enrichment_queue (
        agency_id, client_id, strategy_id, source_kind, source_key, title, prompt, rationale, owner, priority, stage, status, metadata
      )
      values (
        v_client.agency_id,
        p_client_id,
        v_strategy.id,
        'drift_signal',
        'drift:operations_setup_updated_after_strategy',
        'Review execution assumptions',
        'Operations setup changed after the current strategy document. Confirm launch timing, approvals, assets, and delivery assumptions still match the strategy.',
        'Detected newer operations setup than the active strategy document.',
        'shared',
        'medium',
        'operations_setup',
        'ready',
        jsonb_build_object('reason', p_reason, 'signal', 'operations_setup_updated_after_strategy', 'ops_updated_at', v_ops.updated_at)
      )
      on conflict do nothing;
      v_inserted := v_inserted + 1;
    end if;

    if v_brain.id is null or coalesce(v_brain.usable, false) = false then
      insert into public.client_enrichment_queue (
        agency_id, client_id, strategy_id, source_kind, source_key, title, prompt, rationale, owner, priority, stage, status, metadata
      )
      values (
        v_client.agency_id,
        p_client_id,
        v_strategy.id,
        'drift_signal',
        'drift:client_memory_not_usable',
        'Strengthen client memory context',
        'The client brain is missing or not yet usable. Upload key documents or approve knowledge so future strategy and AI outputs use stronger source context.',
        'Detected weak client memory context for an active strategy.',
        'shared',
        'high',
        'progressive_enrichment',
        'ready',
        jsonb_build_object('reason', p_reason, 'signal', 'client_memory_not_usable')
      )
      on conflict do nothing;
      v_inserted := v_inserted + 1;
    end if;
  end if;

  select count(*)
  into v_active_items
  from public.client_enrichment_queue ceq
  where ceq.client_id = p_client_id
    and ceq.status in ('queued', 'ready', 'in_progress');

  insert into public.client_operation_events (
    agency_id,
    client_id,
    event_kind,
    actor_kind,
    payload
  )
  values (
    v_client.agency_id,
    p_client_id,
    'queue_refreshed',
    'system',
    jsonb_build_object(
      'reason', p_reason,
      'attempted_inserts', v_inserted,
      'active_items', v_active_items
    )
  );

  insert into public.client_operation_events (
    agency_id,
    client_id,
    queue_item_id,
    event_kind,
    actor_kind,
    payload
  )
  select
    ceq.agency_id,
    ceq.client_id,
    ceq.id,
    'drift_detected',
    'system',
    jsonb_build_object(
      'source_key', ceq.source_key,
      'title', ceq.title,
      'priority', ceq.priority,
      'stage', ceq.stage,
      'reason', p_reason
    )
  from public.client_enrichment_queue ceq
  where ceq.client_id = p_client_id
    and ceq.source_kind = 'drift_signal'
    and ceq.status in ('queued', 'ready', 'in_progress')
    and not exists (
      select 1
      from public.client_operation_events evt
      where evt.queue_item_id = ceq.id
        and evt.event_kind = 'drift_detected'
    );

  return jsonb_build_object(
    'ok', true,
    'client_id', p_client_id,
    'reason', p_reason,
    'active_items', v_active_items,
    'attempted_inserts', v_inserted
  );
end;
$$;

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
      'previous_status', v_prev.status,
      'next_status', v_task.status,
      'previous_owner', v_prev.owner,
      'next_owner', v_task.owner,
      'previous_due_at', v_prev.due_at,
      'next_due_at', v_task.due_at
    )
  );

  return v_task;
end;
$$;

revoke all on function public.update_client_execution_task(uuid, text, text, timestamptz, boolean) from public;
grant execute on function public.update_client_execution_task(uuid, text, text, timestamptz, boolean) to authenticated;
grant execute on function public.update_client_execution_task(uuid, text, text, timestamptz, boolean) to service_role;
