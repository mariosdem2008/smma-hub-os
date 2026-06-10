-- Strategy execution bridge: 90-day content plan, per-item briefs, draft calendar entries,
-- and approval-gated operational task materialization.

create table if not exists public.content_plan_items (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  strategy_id uuid not null references public.strategies(id) on delete cascade,
  dedupe_key text not null,
  week_index integer not null check (week_index between 1 and 13),
  sequence_index integer not null check (sequence_index between 1 and 7),
  window_start date not null,
  window_end date not null,
  scheduled_for timestamptz,
  pillar_id text not null,
  pillar_name text not null,
  pillar_coverage_percent integer not null default 0 check (pillar_coverage_percent between 0 and 100),
  channel text not null,
  calendar_platform text,
  content_type text not null,
  working_title text not null,
  hook text not null,
  cta text not null,
  campaign_id text,
  campaign_name text,
  status text not null default 'planned'
    check (status in ('planned', 'draft', 'approved', 'in_production', 'scheduled', 'published', 'cancelled')),
  source_modules jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (strategy_id, dedupe_key)
);

create table if not exists public.content_briefs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  strategy_id uuid not null references public.strategies(id) on delete cascade,
  content_plan_item_id uuid not null references public.content_plan_items(id) on delete cascade,
  brief_key text not null,
  angle text not null,
  key_message text not null,
  proof_to_use text not null,
  format_spec text not null,
  dos text[] not null default '{}'::text[],
  donts text[] not null default '{}'::text[],
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'approved', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (strategy_id, brief_key),
  unique (content_plan_item_id)
);

create index if not exists idx_content_plan_items_agency on public.content_plan_items (agency_id, updated_at desc);
create index if not exists idx_content_plan_items_client on public.content_plan_items (client_id, week_index, sequence_index);
create index if not exists idx_content_plan_items_strategy on public.content_plan_items (strategy_id, week_index, sequence_index);
create index if not exists idx_content_plan_items_status on public.content_plan_items (agency_id, status);

create index if not exists idx_content_briefs_agency on public.content_briefs (agency_id, updated_at desc);
create index if not exists idx_content_briefs_client on public.content_briefs (client_id, created_at desc);
create index if not exists idx_content_briefs_strategy on public.content_briefs (strategy_id, created_at desc);

alter table public.content_plan_items enable row level security;
alter table public.content_briefs enable row level security;

create policy content_plan_items_select
on public.content_plan_items
for select
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = content_plan_items.agency_id
      and am.user_id = auth.uid()
  )
);

create policy content_plan_items_admin_write
on public.content_plan_items
for all
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = content_plan_items.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = content_plan_items.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner', 'admin')
  )
);

create policy content_briefs_select
on public.content_briefs
for select
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = content_briefs.agency_id
      and am.user_id = auth.uid()
  )
);

create policy content_briefs_admin_write
on public.content_briefs
for all
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = content_briefs.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = content_briefs.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner', 'admin')
  )
);

drop trigger if exists content_plan_items_updated_at on public.content_plan_items;
create trigger content_plan_items_updated_at
  before update on public.content_plan_items
  for each row execute function public.update_updated_at_column();

drop trigger if exists content_briefs_updated_at on public.content_briefs;
create trigger content_briefs_updated_at
  before update on public.content_briefs
  for each row execute function public.update_updated_at_column();

revoke all on table public.content_plan_items from anon;
revoke all on table public.content_briefs from anon;
grant select, insert, update, delete on table public.content_plan_items to authenticated;
grant select, insert, update, delete on table public.content_briefs to authenticated;
grant all on table public.content_plan_items to service_role;
grant all on table public.content_briefs to service_role;

alter table public.projects
  add column if not exists strategy_id uuid references public.strategies(id) on delete set null,
  add column if not exists content_plan_item_id uuid references public.content_plan_items(id) on delete set null;

create index if not exists idx_projects_strategy_id on public.projects (strategy_id);
create unique index if not exists idx_projects_content_plan_item_unique
  on public.projects (content_plan_item_id)
  where content_plan_item_id is not null;

alter table public.scheduled_posts
  add column if not exists strategy_id uuid references public.strategies(id) on delete set null,
  add column if not exists content_plan_item_id uuid references public.content_plan_items(id) on delete set null;

alter table public.scheduled_posts
  drop constraint if exists scheduled_posts_status_check;

alter table public.scheduled_posts
  add constraint scheduled_posts_status_check
  check (status in ('draft', 'planned', 'pending', 'queued', 'publishing', 'published', 'failed', 'cancelled'));

create index if not exists idx_scheduled_posts_strategy_id on public.scheduled_posts (strategy_id);
create index if not exists idx_scheduled_posts_content_plan_item_id on public.scheduled_posts (content_plan_item_id);
create unique index if not exists idx_scheduled_posts_content_plan_platform_unique
  on public.scheduled_posts (content_plan_item_id, platform)
  where content_plan_item_id is not null;

create or replace function public.persist_strategy_execution_bridge(
  p_agency_id uuid,
  p_client_id uuid,
  p_strategy_id uuid,
  p_user_id uuid default null,
  p_plan_items jsonb default '[]'::jsonb,
  p_content_briefs jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_strategy record;
  v_item jsonb;
  v_brief jsonb;
  v_plan_item_id uuid;
  v_project_id uuid;
  v_calendar_platform text;
  v_plan_count integer := 0;
  v_brief_count integer := 0;
  v_calendar_count integer := 0;
begin
  select id, agency_id, client_id
  into v_strategy
  from public.strategies
  where id = p_strategy_id
    and agency_id = p_agency_id
    and client_id = p_client_id;

  if v_strategy.id is null then
    raise exception 'Strategy % does not belong to agency % and client %', p_strategy_id, p_agency_id, p_client_id;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_plan_items, '[]'::jsonb)) loop
    insert into public.content_plan_items (
      agency_id,
      client_id,
      strategy_id,
      dedupe_key,
      week_index,
      sequence_index,
      window_start,
      window_end,
      scheduled_for,
      pillar_id,
      pillar_name,
      pillar_coverage_percent,
      channel,
      calendar_platform,
      content_type,
      working_title,
      hook,
      cta,
      campaign_id,
      campaign_name,
      status,
      source_modules,
      metadata,
      created_by
    )
    values (
      p_agency_id,
      p_client_id,
      p_strategy_id,
      v_item->>'dedupe_key',
      (v_item->>'week_index')::integer,
      (v_item->>'sequence_index')::integer,
      (v_item->>'window_start')::date,
      (v_item->>'window_end')::date,
      nullif(v_item->>'scheduled_for', '')::timestamptz,
      v_item->>'pillar_id',
      v_item->>'pillar_name',
      coalesce(nullif(v_item->>'pillar_coverage_percent', '')::integer, 0),
      v_item->>'channel',
      nullif(v_item->>'calendar_platform', ''),
      v_item->>'content_type',
      v_item->>'working_title',
      v_item->>'hook',
      v_item->>'cta',
      nullif(v_item->>'campaign_id', ''),
      nullif(v_item->>'campaign_name', ''),
      coalesce(nullif(v_item->>'status', ''), 'planned'),
      coalesce(v_item->'source_modules', '[]'::jsonb),
      jsonb_build_object(
        'bridge_version', 1,
        'generated_by', 'strategy_execution_bridge'
      ),
      p_user_id
    )
    on conflict (strategy_id, dedupe_key) do update set
      week_index = excluded.week_index,
      sequence_index = excluded.sequence_index,
      window_start = excluded.window_start,
      window_end = excluded.window_end,
      scheduled_for = excluded.scheduled_for,
      pillar_id = excluded.pillar_id,
      pillar_name = excluded.pillar_name,
      pillar_coverage_percent = excluded.pillar_coverage_percent,
      channel = excluded.channel,
      calendar_platform = excluded.calendar_platform,
      content_type = excluded.content_type,
      working_title = excluded.working_title,
      hook = excluded.hook,
      cta = excluded.cta,
      campaign_id = excluded.campaign_id,
      campaign_name = excluded.campaign_name,
      status = case
        when content_plan_items.status in ('planned', 'draft') then excluded.status
        else content_plan_items.status
      end,
      source_modules = excluded.source_modules,
      metadata = content_plan_items.metadata || excluded.metadata,
      updated_at = now()
    returning id into v_plan_item_id;

    v_plan_count := v_plan_count + 1;
    v_calendar_platform := nullif(v_item->>'calendar_platform', '');

    if (v_item->>'week_index')::integer <= 3
      and v_calendar_platform in ('instagram', 'facebook', 'linkedin', 'tiktok', 'youtube')
      and nullif(v_item->>'scheduled_for', '') is not null
    then
      insert into public.projects (
        client_id,
        agency_id,
        title,
        description,
        pipeline_stage,
        status,
        platforms,
        scheduled_for,
        time_zone,
        strategy_id,
        content_plan_item_id,
        notes
      )
      values (
        p_client_id,
        p_agency_id,
        v_item->>'working_title',
        concat_ws(E'\n', 'Hook: ' || coalesce(v_item->>'hook', ''), 'CTA: ' || coalesce(v_item->>'cta', '')),
        'idea',
        'idea',
        array[v_calendar_platform],
        (v_item->>'scheduled_for')::timestamptz,
        'UTC',
        p_strategy_id,
        v_plan_item_id,
        'Created from strategy execution bridge plan.'
      )
      on conflict (content_plan_item_id) where content_plan_item_id is not null do update set
        title = case when projects.status in ('idea', 'scripting') then excluded.title else projects.title end,
        description = case when projects.status in ('idea', 'scripting') then excluded.description else projects.description end,
        platforms = case when projects.status in ('idea', 'scripting') then excluded.platforms else projects.platforms end,
        scheduled_for = case when projects.status in ('idea', 'scripting') then excluded.scheduled_for else projects.scheduled_for end,
        strategy_id = excluded.strategy_id,
        updated_at = now()
      returning id into v_project_id;

      insert into public.scheduled_posts (
        project_id,
        agency_id,
        client_id,
        platform,
        scheduled_for,
        status,
        caption,
        hashtags,
        strategy_id,
        content_plan_item_id
      )
      values (
        v_project_id,
        p_agency_id,
        p_client_id,
        v_calendar_platform,
        (v_item->>'scheduled_for')::timestamptz,
        'draft',
        concat_ws(E'\n\n', v_item->>'hook', 'CTA: ' || coalesce(v_item->>'cta', '')),
        null,
        p_strategy_id,
        v_plan_item_id
      )
      on conflict (content_plan_item_id, platform) where content_plan_item_id is not null do update set
        project_id = excluded.project_id,
        scheduled_for = case
          when scheduled_posts.status in ('draft', 'planned') then excluded.scheduled_for
          else scheduled_posts.scheduled_for
        end,
        caption = case
          when scheduled_posts.status in ('draft', 'planned') then excluded.caption
          else scheduled_posts.caption
        end,
        status = case
          when scheduled_posts.status in ('draft', 'planned') then excluded.status
          else scheduled_posts.status
        end,
        strategy_id = excluded.strategy_id,
        updated_at = now();

      v_calendar_count := v_calendar_count + 1;
    end if;
  end loop;

  for v_brief in select * from jsonb_array_elements(coalesce(p_content_briefs, '[]'::jsonb)) loop
    select id
    into v_plan_item_id
    from public.content_plan_items
    where strategy_id = p_strategy_id
      and dedupe_key = v_brief->>'plan_item_dedupe_key';

    if v_plan_item_id is null then
      continue;
    end if;

    insert into public.content_briefs (
      agency_id,
      client_id,
      strategy_id,
      content_plan_item_id,
      brief_key,
      angle,
      key_message,
      proof_to_use,
      format_spec,
      dos,
      donts,
      status,
      metadata,
      created_by
    )
    values (
      p_agency_id,
      p_client_id,
      p_strategy_id,
      v_plan_item_id,
      v_brief->>'brief_key',
      v_brief->>'angle',
      v_brief->>'key_message',
      v_brief->>'proof_to_use',
      v_brief->>'format_spec',
      ARRAY(select jsonb_array_elements_text(coalesce(v_brief->'dos', '[]'::jsonb))),
      ARRAY(select jsonb_array_elements_text(coalesce(v_brief->'donts', '[]'::jsonb))),
      coalesce(nullif(v_brief->>'status', ''), 'draft'),
      jsonb_build_object(
        'bridge_version', 1,
        'plan_item_dedupe_key', v_brief->>'plan_item_dedupe_key'
      ),
      p_user_id
    )
    on conflict (strategy_id, brief_key) do update set
      content_plan_item_id = excluded.content_plan_item_id,
      angle = excluded.angle,
      key_message = excluded.key_message,
      proof_to_use = excluded.proof_to_use,
      format_spec = excluded.format_spec,
      dos = excluded.dos,
      donts = excluded.donts,
      status = case
        when content_briefs.status in ('draft', 'ready') then excluded.status
        else content_briefs.status
      end,
      metadata = content_briefs.metadata || excluded.metadata,
      updated_at = now();

    v_brief_count := v_brief_count + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'strategy_id', p_strategy_id,
    'plan_items_upserted', v_plan_count,
    'content_briefs_upserted', v_brief_count,
    'calendar_entries_upserted', v_calendar_count,
    'status', 'draft_bridge_created'
  );
end;
$$;

revoke all on function public.persist_strategy_execution_bridge(uuid, uuid, uuid, uuid, jsonb, jsonb) from public;
grant execute on function public.persist_strategy_execution_bridge(uuid, uuid, uuid, uuid, jsonb, jsonb) to service_role;

create or replace function public.materialize_strategy_approved_work(
  p_strategy_id uuid,
  p_reason text default 'strategy_approval'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_strategy record;
  v_is_service boolean := coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
  v_has_approval boolean := false;
  v_refresh jsonb;
begin
  select id, agency_id, client_id
  into v_strategy
  from public.strategies
  where id = p_strategy_id;

  if v_strategy.id is null then
    return jsonb_build_object('ok', false, 'reason', 'strategy_not_found');
  end if;

  if not v_is_service then
    if auth.uid() is null or not exists (
      select 1
      from public.agency_members am
      where am.agency_id = v_strategy.agency_id
        and am.user_id = auth.uid()
    ) then
      raise exception 'Forbidden';
    end if;
  end if;

  select (
    exists (
      select 1
      from public.strategy_modules sm
      where sm.strategy_id = p_strategy_id
        and sm.status = 'approved'
    )
    or exists (
      select 1
      from public.strategy_artifacts_v2 sa
      where sa.published_to_strategy_id = p_strategy_id
        and sa.status = 'approved'
    )
  )
  into v_has_approval;

  if not v_has_approval then
    return jsonb_build_object('ok', false, 'reason', 'strategy_not_approved');
  end if;

  v_refresh := public.refresh_client_execution_tasks(v_strategy.client_id, p_reason);

  return jsonb_build_object(
    'ok', true,
    'strategy_id', p_strategy_id,
    'client_id', v_strategy.client_id,
    'reason', p_reason,
    'execution_task_refresh', v_refresh
  );
end;
$$;

revoke all on function public.materialize_strategy_approved_work(uuid, text) from public;
grant execute on function public.materialize_strategy_approved_work(uuid, text) to authenticated;
grant execute on function public.materialize_strategy_approved_work(uuid, text) to service_role;

create or replace function public.create_strategy_snapshot(
  p_client_id uuid,
  p_agency_id uuid,
  p_strategy_id uuid,
  p_user_id uuid,
  p_modules jsonb,
  p_document_markdown text,
  p_document_html text,
  p_model text,
  p_instruction text,
  p_derived_hash text,
  p_decisions jsonb default null,
  p_tasks jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_strategy_id uuid := p_strategy_id;
  v_document_id uuid;
  v_version int;
  v_module jsonb;
  v_decision jsonb;
  v_task jsonb;
  v_module_id uuid;
  v_task_id uuid;
  v_task_module public.strategy_module;
  v_task_dedupe_key text;
  v_task_period_key text;
  v_task_slug text;
begin
  if v_strategy_id is null then
    select coalesce(max(version_int), 0) + 1 into v_version
    from public.strategies
    where client_id = p_client_id;

    insert into public.strategies (client_id, agency_id, version_int, status, created_by)
    values (p_client_id, p_agency_id, v_version, 'active', p_user_id)
    returning id into v_strategy_id;
  end if;

  update public.strategy_documents
  set is_active = false
  where client_id = p_client_id;

  insert into public.strategy_documents (
    agency_id,
    client_id,
    content_markdown,
    content_html,
    source,
    is_active,
    generated_by_user_id,
    model,
    generation_instruction,
    derived_from_hash
  )
  values (
    p_agency_id,
    p_client_id,
    p_document_markdown,
    p_document_html,
    'ai',
    true,
    p_user_id,
    p_model,
    p_instruction,
    p_derived_hash
  )
  returning id into v_document_id;

  for v_module in select * from jsonb_array_elements(p_modules) loop
    insert into public.strategy_modules (
      client_id,
      agency_id,
      strategy_id,
      module,
      content_json,
      status,
      ai_generated,
      ai_confidence,
      created_by
    )
    values (
      p_client_id,
      p_agency_id,
      v_strategy_id,
      (v_module->>'module')::public.strategy_module,
      v_module->'content_json',
      'draft',
      true,
      case when v_module ? 'ai_confidence' then (v_module->>'ai_confidence')::int else null end,
      p_user_id
    )
    on conflict (strategy_id, module) do update set
      content_json = excluded.content_json,
      status = excluded.status,
      ai_generated = excluded.ai_generated,
      ai_confidence = excluded.ai_confidence,
      version = public.strategy_modules.version + 1,
      updated_at = now()
    returning id into v_module_id;
  end loop;

  if p_decisions is not null then
    for v_decision in select * from jsonb_array_elements(p_decisions) loop
      insert into public.strategy_decisions (
        strategy_id,
        client_id,
        module,
        decision_key,
        value,
        locked
      )
      values (
        v_strategy_id,
        p_client_id,
        (v_decision->>'module')::public.strategy_module,
        v_decision->>'decision_key',
        v_decision->'value',
        coalesce((v_decision->>'locked')::boolean, false)
      )
      on conflict (strategy_id, module, decision_key) do update set
        value = excluded.value,
        locked = excluded.locked,
        updated_at = now();
    end loop;
  end if;

  if p_tasks is not null then
    for v_task in select * from jsonb_array_elements(p_tasks) loop
      v_task_module := null;
      if nullif(v_task->>'module', '') is not null then
        v_task_module := (v_task->>'module')::public.strategy_module;

        select id into v_module_id
        from public.strategy_modules
        where strategy_id = v_strategy_id
          and module = v_task_module;
      else
        v_module_id := null;
      end if;

      v_task_dedupe_key := nullif(v_task->>'dedupe_key', '');
      v_task_period_key := coalesce(nullif(v_task->>'period_key', ''), 'base');
      v_task_slug := coalesce(
        nullif(v_task->>'slug', ''),
        nullif(regexp_replace(lower(coalesce(v_task_dedupe_key, v_task->>'title', 'task')), '[^a-z0-9]+', '-', 'g'), ''),
        'task'
      );

      v_task_id := null;

      if v_task_dedupe_key is not null then
        select id into v_task_id
        from public.strategy_tasks
        where strategy_id = v_strategy_id
          and dedupe_key = v_task_dedupe_key
        order by created_at asc
        limit 1;
      end if;

      if v_task_id is null then
        insert into public.strategy_tasks (
          strategy_id,
          client_id,
          module_id,
          module,
          title,
          description,
          priority,
          status,
          period_key,
          slug,
          dedupe_key,
          created_by
        )
        values (
          v_strategy_id,
          p_client_id,
          v_module_id,
          v_task_module,
          v_task->>'title',
          v_task->>'description',
          coalesce(v_task->>'priority', 'medium'),
          'todo',
          v_task_period_key,
          v_task_slug,
          v_task_dedupe_key,
          p_user_id
        )
        on conflict (strategy_id, module, period_key, slug) do update set
          title = excluded.title,
          description = excluded.description,
          priority = excluded.priority,
          dedupe_key = coalesce(excluded.dedupe_key, public.strategy_tasks.dedupe_key),
          module_id = excluded.module_id,
          updated_at = now();
      else
        update public.strategy_tasks
        set
          module_id = v_module_id,
          module = v_task_module,
          title = v_task->>'title',
          description = v_task->>'description',
          priority = coalesce(v_task->>'priority', priority),
          period_key = v_task_period_key,
          slug = v_task_slug,
          updated_at = now()
        where id = v_task_id;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'strategy_id', v_strategy_id,
    'document_id', v_document_id
  );
end;
$$;

revoke all on function public.create_strategy_snapshot(
  uuid, uuid, uuid, uuid, jsonb, text, text, text, text, text, jsonb, jsonb
) from public;

grant execute on function public.create_strategy_snapshot(
  uuid, uuid, uuid, uuid, jsonb, text, text, text, text, text, jsonb, jsonb
) to service_role;
