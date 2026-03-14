-- Resolution registry for derived enrichment items so resolved signals stay resolved

create table if not exists public.client_enrichment_resolutions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  source_kind text not null,
  source_key text not null,
  resolution_status text not null
    check (resolution_status in ('resolved', 'dismissed')),
  source_snapshot_hash text,
  resolution_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, source_kind, source_key)
);

create index if not exists idx_client_enrichment_resolutions_client
  on public.client_enrichment_resolutions (client_id, source_kind, updated_at desc);

alter table public.client_enrichment_resolutions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'client_enrichment_resolutions'
      and policyname = 'client_enrichment_resolutions_select'
  ) then
    execute $policy$
      create policy "client_enrichment_resolutions_select"
      on public.client_enrichment_resolutions
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = client_enrichment_resolutions.agency_id
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
      and tablename = 'client_enrichment_resolutions'
      and policyname = 'client_enrichment_resolutions_admin_write'
  ) then
    execute $policy$
      create policy "client_enrichment_resolutions_admin_write"
      on public.client_enrichment_resolutions
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = client_enrichment_resolutions.agency_id
            and am.user_id = auth.uid()
            and am.role in ('owner', 'admin')
        )
      )
      with check (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = client_enrichment_resolutions.agency_id
            and am.user_id = auth.uid()
            and am.role in ('owner', 'admin')
        )
      );
    $policy$;
  end if;
end $$;

drop trigger if exists client_enrichment_resolutions_updated_at on public.client_enrichment_resolutions;
create trigger client_enrichment_resolutions_updated_at
  before update on public.client_enrichment_resolutions
  for each row
  execute function public.update_updated_at_column();

grant select, insert, update, delete on table public.client_enrichment_resolutions to authenticated;
grant all on table public.client_enrichment_resolutions to service_role;

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
  v_hash text;
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
      v_hash := md5(coalesce(v_field, '') || '|' || coalesce(v_profile.updated_at::text, ''));
      if exists (
        select 1
        from public.client_enrichment_resolutions cer
        where cer.client_id = p_client_id
          and cer.source_kind = 'onboarding_gap'
          and cer.source_key = 'onboarding:' || v_field
          and cer.source_snapshot_hash = v_hash
      ) then
        continue;
      end if;

      insert into public.client_enrichment_queue (
        agency_id, client_id, source_kind, source_key, title, prompt, rationale, owner, priority, stage, status, metadata
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
        jsonb_build_object('field', v_field, 'reason', p_reason, 'source_snapshot_hash', v_hash)
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

        v_hash := md5(coalesce(v_module.module::text, '') || '|' || coalesce(v_question, '') || '|' || coalesce(v_module.updated_at::text, ''));
        if exists (
          select 1
          from public.client_enrichment_resolutions cer
          where cer.client_id = p_client_id
            and cer.source_kind = 'strategy_open_question'
            and cer.source_key = 'open_question:' || v_module.module || ':' || md5(v_question)
            and cer.source_snapshot_hash = v_hash
        ) then
          continue;
        end if;

        insert into public.client_enrichment_queue (
          agency_id, client_id, strategy_id, source_kind, source_key, title, prompt, rationale, owner, priority, stage, status, metadata
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
          jsonb_build_object('module', v_module.module, 'reason', p_reason, 'source_snapshot_hash', v_hash)
        )
        on conflict do nothing;
        v_inserted := v_inserted + 1;
      end loop;

      for v_blocker in
        select value
        from jsonb_array_elements(coalesce(v_module.blockers, '[]'::jsonb))
      loop
        v_hash := md5(
          coalesce(v_module.module::text, '') || '|' ||
          coalesce(v_blocker->>'code', '') || '|' ||
          coalesce(v_blocker->>'message', '') || '|' ||
          coalesce(v_blocker->>'field_path', '') || '|' ||
          coalesce(v_blocker->>'severity', '') || '|' ||
          coalesce(v_module.updated_at::text, '')
        );
        if exists (
          select 1
          from public.client_enrichment_resolutions cer
          where cer.client_id = p_client_id
            and cer.source_kind = 'strategy_blocker'
            and cer.source_key = 'blocker:' || v_module.module || ':' || coalesce(v_blocker->>'code', md5(coalesce(v_blocker->>'message', 'blocker')))
            and cer.source_snapshot_hash = v_hash
        ) then
          continue;
        end if;

        insert into public.client_enrichment_queue (
          agency_id, client_id, strategy_id, source_kind, source_key, title, prompt, rationale, owner, priority, stage, status, metadata
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
            'reason', p_reason,
            'source_snapshot_hash', v_hash
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

    v_hash := md5(coalesce(v_doc.updated_at::text, 'missing') || '|' || coalesce(v_strategy.updated_at::text, 'missing'));
    if (v_doc.id is null or exists (
      select 1
      from public.strategy_modules sm
      where sm.strategy_id = v_strategy.id
        and sm.updated_at > coalesce(v_doc.updated_at, 'epoch'::timestamptz)
    )) and not exists (
      select 1
      from public.client_enrichment_resolutions cer
      where cer.client_id = p_client_id
        and cer.source_kind = 'drift_signal'
        and cer.source_key = 'drift:strategy_document_outdated'
        and cer.source_snapshot_hash = v_hash
    ) then
      insert into public.client_enrichment_queue (
        agency_id, client_id, strategy_id, source_kind, source_key, title, prompt, rationale, owner, priority, stage, status, metadata
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
        jsonb_build_object('reason', p_reason, 'signal', 'strategy_document_outdated', 'source_snapshot_hash', v_hash)
      )
      on conflict do nothing;
      v_inserted := v_inserted + 1;
    end if;

    v_hash := md5('onboarding_after_strategy|' || coalesce(v_profile.updated_at::text, 'missing') || '|' || coalesce(v_doc.updated_at::text, 'missing'));
    if v_profile.client_id is not null and v_doc.id is not null and v_profile.updated_at > v_doc.updated_at and not exists (
      select 1
      from public.client_enrichment_resolutions cer
      where cer.client_id = p_client_id
        and cer.source_kind = 'drift_signal'
        and cer.source_key = 'drift:onboarding_updated_after_strategy'
        and cer.source_snapshot_hash = v_hash
    ) then
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
        jsonb_build_object('reason', p_reason, 'signal', 'onboarding_updated_after_strategy', 'profile_updated_at', v_profile.updated_at, 'source_snapshot_hash', v_hash)
      )
      on conflict do nothing;
      v_inserted := v_inserted + 1;
    end if;

    v_hash := md5('brain_after_strategy|' || coalesce(v_brain.updated_at::text, 'missing') || '|' || coalesce(v_doc.updated_at::text, 'missing'));
    if v_brain.id is not null and v_doc.id is not null and v_brain.updated_at > v_doc.updated_at and not exists (
      select 1
      from public.client_enrichment_resolutions cer
      where cer.client_id = p_client_id
        and cer.source_kind = 'drift_signal'
        and cer.source_key = 'drift:client_brain_updated_after_strategy'
        and cer.source_snapshot_hash = v_hash
    ) then
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
        jsonb_build_object('reason', p_reason, 'signal', 'client_brain_updated_after_strategy', 'brain_updated_at', v_brain.updated_at, 'source_snapshot_hash', v_hash)
      )
      on conflict do nothing;
      v_inserted := v_inserted + 1;
    end if;

    v_hash := md5('ops_after_strategy|' || coalesce(v_ops.updated_at::text, 'missing') || '|' || coalesce(v_doc.updated_at::text, 'missing'));
    if v_ops.client_id is not null and v_doc.id is not null and v_ops.updated_at > v_doc.updated_at and not exists (
      select 1
      from public.client_enrichment_resolutions cer
      where cer.client_id = p_client_id
        and cer.source_kind = 'drift_signal'
        and cer.source_key = 'drift:operations_setup_updated_after_strategy'
        and cer.source_snapshot_hash = v_hash
    ) then
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
        jsonb_build_object('reason', p_reason, 'signal', 'operations_setup_updated_after_strategy', 'ops_updated_at', v_ops.updated_at, 'source_snapshot_hash', v_hash)
      )
      on conflict do nothing;
      v_inserted := v_inserted + 1;
    end if;

    v_hash := md5('memory_not_usable|' || coalesce(v_brain.updated_at::text, 'missing'));
    if (v_brain.id is null or coalesce(v_brain.usable, false) = false) and not exists (
      select 1
      from public.client_enrichment_resolutions cer
      where cer.client_id = p_client_id
        and cer.source_kind = 'drift_signal'
        and cer.source_key = 'drift:client_memory_not_usable'
        and cer.source_snapshot_hash = v_hash
    ) then
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
        jsonb_build_object('reason', p_reason, 'signal', 'client_memory_not_usable', 'source_snapshot_hash', v_hash)
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
    agency_id, client_id, event_kind, actor_kind, payload
  )
  values (
    v_client.agency_id,
    p_client_id,
    'queue_refreshed',
    'system',
    jsonb_build_object('reason', p_reason, 'attempted_inserts', v_inserted, 'active_items', v_active_items)
  );

  insert into public.client_operation_events (
    agency_id, client_id, queue_item_id, event_kind, actor_kind, payload
  )
  select
    ceq.agency_id,
    ceq.client_id,
    ceq.id,
    'drift_detected',
    'system',
    jsonb_build_object('source_key', ceq.source_key, 'title', ceq.title, 'priority', ceq.priority, 'stage', ceq.stage, 'reason', p_reason)
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
