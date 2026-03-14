-- First-class operations setup persistence + progressive enrichment queue

create table if not exists public.client_operations_setup (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null unique references public.clients(id) on delete cascade,
  source_profile_id uuid references public.client_onboarding_profiles(id) on delete set null,
  setup_status text not null default 'draft'
    check (setup_status in ('draft', 'in_progress', 'ready')),
  primary_contact_name text,
  primary_contact_role text,
  primary_contact_email text,
  main_approver_name text,
  main_approver_role text,
  approval_sla text,
  preferred_comms_channel text,
  launch_window text,
  required_access_status jsonb not null default '[]'::jsonb,
  missing_assets jsonb not null default '[]'::jsonb,
  escalation_contact text,
  operating_languages jsonb not null default '[]'::jsonb,
  preferred_formats jsonb not null default '[]'::jsonb,
  cadence_expectation text,
  response_handling text,
  on_camera_availability text,
  checklist_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_operations_setup_agency
  on public.client_operations_setup (agency_id, updated_at desc);

create index if not exists idx_client_operations_setup_status
  on public.client_operations_setup (setup_status, updated_at desc);

alter table public.client_operations_setup enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'client_operations_setup'
      and policyname = 'client_operations_setup_select'
  ) then
    execute $policy$
      create policy "client_operations_setup_select"
      on public.client_operations_setup
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = client_operations_setup.agency_id
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
      and tablename = 'client_operations_setup'
      and policyname = 'client_operations_setup_admin_write'
  ) then
    execute $policy$
      create policy "client_operations_setup_admin_write"
      on public.client_operations_setup
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = client_operations_setup.agency_id
            and am.user_id = auth.uid()
            and am.role in ('owner', 'admin')
        )
      )
      with check (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = client_operations_setup.agency_id
            and am.user_id = auth.uid()
            and am.role in ('owner', 'admin')
        )
      );
    $policy$;
  end if;
end $$;

drop trigger if exists client_operations_setup_updated_at on public.client_operations_setup;
create trigger client_operations_setup_updated_at
  before update on public.client_operations_setup
  for each row
  execute function public.update_updated_at_column();

grant select, insert, update, delete on table public.client_operations_setup to authenticated;
grant all on table public.client_operations_setup to service_role;

create table if not exists public.client_enrichment_queue (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  strategy_id uuid references public.strategies(id) on delete set null,
  source_kind text not null
    check (source_kind in ('onboarding_gap', 'strategy_open_question', 'strategy_blocker', 'drift_signal', 'manual')),
  source_key text not null,
  title text not null,
  prompt text not null,
  rationale text,
  owner text not null default 'agency'
    check (owner in ('client', 'agency', 'shared', 'system')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  stage text
    check (stage is null or stage in ('essential_intake', 'operations_setup', 'progressive_enrichment', 'strategy')),
  status text not null default 'queued'
    check (status in ('queued', 'ready', 'in_progress', 'resolved', 'dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_client_enrichment_queue_client_status
  on public.client_enrichment_queue (client_id, status, priority, created_at desc);

create index if not exists idx_client_enrichment_queue_agency
  on public.client_enrichment_queue (agency_id, created_at desc);

create unique index if not exists idx_client_enrichment_queue_active_source
  on public.client_enrichment_queue (client_id, source_kind, source_key)
  where status in ('queued', 'ready', 'in_progress');

alter table public.client_enrichment_queue enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'client_enrichment_queue'
      and policyname = 'client_enrichment_queue_select'
  ) then
    execute $policy$
      create policy "client_enrichment_queue_select"
      on public.client_enrichment_queue
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = client_enrichment_queue.agency_id
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
      and tablename = 'client_enrichment_queue'
      and policyname = 'client_enrichment_queue_admin_write'
  ) then
    execute $policy$
      create policy "client_enrichment_queue_admin_write"
      on public.client_enrichment_queue
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = client_enrichment_queue.agency_id
            and am.user_id = auth.uid()
            and am.role in ('owner', 'admin')
        )
      )
      with check (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = client_enrichment_queue.agency_id
            and am.user_id = auth.uid()
            and am.role in ('owner', 'admin')
        )
      );
    $policy$;
  end if;
end $$;

drop trigger if exists client_enrichment_queue_updated_at on public.client_enrichment_queue;
create trigger client_enrichment_queue_updated_at
  before update on public.client_enrichment_queue
  for each row
  execute function public.update_updated_at_column();

grant select, insert, update, delete on table public.client_enrichment_queue to authenticated;
grant all on table public.client_enrichment_queue to service_role;

create or replace function public.client_onboarding_field_label(p_field text)
returns text
language sql
immutable
as $$
  select case p_field
    when 'ops_primary_contact' then 'Primary contact'
    when 'ops_main_approver' then 'Main approver'
    when 'ops_preferred_comms' then 'Preferred communication channel'
    when 'ops_launch_window' then 'Launch window'
    when 'ops_access_status' then 'Access readiness'
    when 'ops_missing_assets' then 'Missing assets'
    when 'q4_languages' then 'Operating languages'
    when 'formats' then 'Content formats'
    when 'cadence_requirement' then 'Cadence expectation'
    when 'on_camera_availability' then 'On-camera availability'
    when 'response_handling' then 'Response handling'
    when 'audience_type' then 'Audience type'
    when 'main_objection' then 'Main objection'
    when 'q9_pain_points' then 'Pain points'
    when 'brand_voice' then 'Brand voice'
    when 'content_style' then 'Content style'
    when 'proof_types' then 'Proof assets'
    when 'competitor_link' then 'Competitor reference'
    when 'q13_differentiators' then 'Differentiators'
    else initcap(replace(replace(coalesce(p_field, 'item'), '_', ' '), '.', ' '))
  end;
$$;

create or replace function public.sync_client_operations_setup_from_onboarding(p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_ops jsonb := '{}'::jsonb;
  v_stage jsonb := '{}'::jsonb;
  v_status text := 'draft';
begin
  select
    cop.id,
    cop.agency_id,
    cop.client_id,
    cop.q4_languages,
    cop.formats,
    cop.cadence_preset,
    cop.response_handling,
    cop.on_camera_availability,
    cop.v5_meta
  into v_profile
  from public.client_onboarding_profiles cop
  where cop.client_id = p_client_id
  order by cop.updated_at desc
  limit 1;

  if v_profile.client_id is null then
    return jsonb_build_object('ok', false, 'reason', 'profile_not_found');
  end if;

  v_ops := coalesce(v_profile.v5_meta->'operations_setup', '{}'::jsonb);
  v_stage := coalesce(v_profile.v5_meta->'staged_readiness'->'operations_setup', '{}'::jsonb);

  v_status := case
    when coalesce((v_stage->>'percent')::int, 0) >= 100 then 'ready'
    when jsonb_typeof(v_ops) = 'object'
      and exists (
        select 1
        from jsonb_object_keys(v_ops) as key
        limit 1
      ) then 'in_progress'
    else 'draft'
  end;

  insert into public.client_operations_setup (
    agency_id,
    client_id,
    source_profile_id,
    setup_status,
    primary_contact_name,
    primary_contact_role,
    primary_contact_email,
    main_approver_name,
    main_approver_role,
    approval_sla,
    preferred_comms_channel,
    launch_window,
    required_access_status,
    missing_assets,
    escalation_contact,
    operating_languages,
    preferred_formats,
    cadence_expectation,
    response_handling,
    on_camera_availability,
    checklist_summary
  )
  values (
    v_profile.agency_id,
    v_profile.client_id,
    v_profile.id,
    v_status,
    nullif(v_ops->>'primary_contact_name', ''),
    nullif(v_ops->>'primary_contact_role', ''),
    nullif(v_ops->>'primary_contact_email', ''),
    nullif(v_ops->>'main_approver_name', ''),
    nullif(v_ops->>'main_approver_role', ''),
    nullif(v_ops->>'approval_sla', ''),
    nullif(v_ops->>'preferred_comms_channel', ''),
    nullif(v_ops->>'launch_window', ''),
    coalesce(v_ops->'required_access_status', '[]'::jsonb),
    coalesce(v_ops->'missing_assets', '[]'::jsonb),
    nullif(v_ops->>'escalation_contact', ''),
    coalesce(to_jsonb(v_profile.q4_languages), '[]'::jsonb),
    coalesce(to_jsonb(v_profile.formats), '[]'::jsonb),
    nullif(v_profile.cadence_preset, ''),
    nullif(v_profile.response_handling, ''),
    nullif(v_profile.on_camera_availability, ''),
    jsonb_build_object(
      'state', coalesce(v_profile.v5_meta->'staged_readiness'->>'state', 'draft_started'),
      'operations_setup', v_stage,
      'updated_at', now()
    )
  )
  on conflict (client_id) do update set
    agency_id = excluded.agency_id,
    source_profile_id = excluded.source_profile_id,
    setup_status = excluded.setup_status,
    primary_contact_name = excluded.primary_contact_name,
    primary_contact_role = excluded.primary_contact_role,
    primary_contact_email = excluded.primary_contact_email,
    main_approver_name = excluded.main_approver_name,
    main_approver_role = excluded.main_approver_role,
    approval_sla = excluded.approval_sla,
    preferred_comms_channel = excluded.preferred_comms_channel,
    launch_window = excluded.launch_window,
    required_access_status = excluded.required_access_status,
    missing_assets = excluded.missing_assets,
    escalation_contact = excluded.escalation_contact,
    operating_languages = excluded.operating_languages,
    preferred_formats = excluded.preferred_formats,
    cadence_expectation = excluded.cadence_expectation,
    response_handling = excluded.response_handling,
    on_camera_availability = excluded.on_camera_availability,
    checklist_summary = excluded.checklist_summary,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'client_id', v_profile.client_id,
    'setup_status', v_status
  );
end;
$$;

revoke all on function public.sync_client_operations_setup_from_onboarding(uuid) from public;
grant execute on function public.sync_client_operations_setup_from_onboarding(uuid) to authenticated;
grant execute on function public.sync_client_operations_setup_from_onboarding(uuid) to service_role;

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
  v_blocker jsonb;
  v_field text;
  v_question text;
  v_inserted integer := 0;
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

  select s.id, s.version_int
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
        jsonb_build_object('reason', p_reason)
      )
      on conflict do nothing;
      v_inserted := v_inserted + 1;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'client_id', p_client_id,
    'reason', p_reason,
    'active_items', (
      select count(*)
      from public.client_enrichment_queue ceq
      where ceq.client_id = p_client_id
        and ceq.status in ('queued', 'ready', 'in_progress')
    ),
    'attempted_inserts', v_inserted
  );
end;
$$;

revoke all on function public.refresh_client_enrichment_queue(uuid, text) from public;
grant execute on function public.refresh_client_enrichment_queue(uuid, text) to authenticated;
grant execute on function public.refresh_client_enrichment_queue(uuid, text) to service_role;

with existing_profiles as (
  select client_id
  from public.client_onboarding_profiles
)
select public.sync_client_operations_setup_from_onboarding(client_id)
from existing_profiles;

with existing_clients as (
  select distinct client_id
  from public.client_onboarding_profiles
)
select public.refresh_client_enrichment_queue(client_id, 'migration_backfill')
from existing_clients;
