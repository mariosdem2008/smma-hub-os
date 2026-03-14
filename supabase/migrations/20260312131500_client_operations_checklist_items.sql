-- Persisted operations checklist items with owner/status lifecycle

create table if not exists public.client_operations_checklist_items (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  setup_id uuid references public.client_operations_setup(id) on delete cascade,
  item_key text not null,
  section_key text not null,
  title text not null,
  description text,
  owner text not null
    check (owner in ('client', 'agency', 'shared')),
  status text not null default 'todo'
    check (status in ('todo', 'waiting_on_client', 'in_progress', 'blocked', 'done')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  due_at timestamptz,
  resolved_at timestamptz,
  source_kind text not null default 'derived'
    check (source_kind in ('derived', 'manual')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, item_key)
);

create index if not exists idx_client_operations_checklist_items_client
  on public.client_operations_checklist_items (client_id, status, priority, created_at desc);

create index if not exists idx_client_operations_checklist_items_setup
  on public.client_operations_checklist_items (setup_id, section_key, created_at desc);

alter table public.client_operations_checklist_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'client_operations_checklist_items'
      and policyname = 'client_operations_checklist_items_select'
  ) then
    execute $policy$
      create policy "client_operations_checklist_items_select"
      on public.client_operations_checklist_items
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = client_operations_checklist_items.agency_id
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
      and tablename = 'client_operations_checklist_items'
      and policyname = 'client_operations_checklist_items_admin_write'
  ) then
    execute $policy$
      create policy "client_operations_checklist_items_admin_write"
      on public.client_operations_checklist_items
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = client_operations_checklist_items.agency_id
            and am.user_id = auth.uid()
            and am.role in ('owner', 'admin')
        )
      )
      with check (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = client_operations_checklist_items.agency_id
            and am.user_id = auth.uid()
            and am.role in ('owner', 'admin')
        )
      );
    $policy$;
  end if;
end $$;

drop trigger if exists client_operations_checklist_items_updated_at on public.client_operations_checklist_items;
create trigger client_operations_checklist_items_updated_at
  before update on public.client_operations_checklist_items
  for each row
  execute function public.update_updated_at_column();

grant select, insert, update, delete on table public.client_operations_checklist_items to authenticated;
grant all on table public.client_operations_checklist_items to service_role;

create or replace function public.refresh_client_operations_checklist(p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_setup record;
  v_items jsonb;
  v_item jsonb;
  v_count integer := 0;
begin
  select *
  into v_setup
  from public.client_operations_setup
  where client_id = p_client_id
  limit 1;

  if v_setup.client_id is null then
    return jsonb_build_object('ok', false, 'reason', 'setup_not_found');
  end if;

  v_items := jsonb_build_array(
    jsonb_build_object(
      'item_key', 'primary_contact',
      'section_key', 'contacts_approvals',
      'title', 'Primary contact',
      'description', 'Named day-to-day contact for delivery questions and file requests.',
      'owner', 'client',
      'complete', coalesce(nullif(v_setup.primary_contact_name, ''), '') <> '',
      'priority', 'high'
    ),
    jsonb_build_object(
      'item_key', 'main_approver',
      'section_key', 'contacts_approvals',
      'title', 'Main approver',
      'description', 'Person responsible for sign-off on content, campaigns, or revisions.',
      'owner', 'client',
      'complete', coalesce(nullif(v_setup.main_approver_name, ''), '') <> '',
      'priority', 'high'
    ),
    jsonb_build_object(
      'item_key', 'approval_sla',
      'section_key', 'contacts_approvals',
      'title', 'Approval turnaround',
      'description', 'Expected review speed so the team can plan publishing cadence safely.',
      'owner', 'shared',
      'complete', coalesce(nullif(v_setup.approval_sla, ''), '') <> '',
      'priority', 'medium'
    ),
    jsonb_build_object(
      'item_key', 'escalation_contact',
      'section_key', 'contacts_approvals',
      'title', 'Escalation path',
      'description', 'Backup contact if approvals or access requests get stuck.',
      'owner', 'shared',
      'complete', coalesce(nullif(v_setup.escalation_contact, ''), '') <> '',
      'priority', 'low'
    ),
    jsonb_build_object(
      'item_key', 'preferred_comms',
      'section_key', 'delivery_readiness',
      'title', 'Preferred communication channel',
      'description', 'Primary coordination channel for the account.',
      'owner', 'shared',
      'complete', coalesce(nullif(v_setup.preferred_comms_channel, ''), '') <> '',
      'priority', 'high'
    ),
    jsonb_build_object(
      'item_key', 'launch_window',
      'section_key', 'delivery_readiness',
      'title', 'Launch window',
      'description', 'Time expectation for first deliverables or go-live motion.',
      'owner', 'shared',
      'complete', coalesce(nullif(v_setup.launch_window, ''), '') <> '',
      'priority', 'high'
    ),
    jsonb_build_object(
      'item_key', 'access_readiness',
      'section_key', 'delivery_readiness',
      'title', 'Access readiness',
      'description', 'Visibility into required accounts, tools, and permissions.',
      'owner', 'client',
      'complete', jsonb_array_length(coalesce(v_setup.required_access_status, '[]'::jsonb)) > 0,
      'priority', 'high'
    ),
    jsonb_build_object(
      'item_key', 'missing_assets',
      'section_key', 'delivery_readiness',
      'title', 'Missing assets',
      'description', 'List of still-needed files, brand assets, or creative inputs.',
      'owner', 'client',
      'complete', v_setup.missing_assets is not null,
      'priority', 'high'
    ),
    jsonb_build_object(
      'item_key', 'response_handling',
      'section_key', 'delivery_readiness',
      'title', 'Lead and DM handling',
      'description', 'Clarifies who responds when leads, DMs, or comments arrive.',
      'owner', 'shared',
      'complete', coalesce(nullif(v_setup.response_handling, ''), '') <> '',
      'priority', 'high'
    ),
    jsonb_build_object(
      'item_key', 'languages',
      'section_key', 'production_inputs',
      'title', 'Operating languages',
      'description', 'Languages the team should use for copy, scripts, and publishing.',
      'owner', 'shared',
      'complete', jsonb_array_length(coalesce(v_setup.operating_languages, '[]'::jsonb)) > 0,
      'priority', 'medium'
    ),
    jsonb_build_object(
      'item_key', 'formats',
      'section_key', 'production_inputs',
      'title', 'Content formats',
      'description', 'Preferred deliverable types so production starts in the right format.',
      'owner', 'agency',
      'complete', jsonb_array_length(coalesce(v_setup.preferred_formats, '[]'::jsonb)) > 0,
      'priority', 'medium'
    ),
    jsonb_build_object(
      'item_key', 'cadence',
      'section_key', 'production_inputs',
      'title', 'Cadence expectation',
      'description', 'Posting frequency or pacing for content planning.',
      'owner', 'agency',
      'complete', coalesce(nullif(v_setup.cadence_expectation, ''), '') <> '',
      'priority', 'medium'
    ),
    jsonb_build_object(
      'item_key', 'on_camera',
      'section_key', 'production_inputs',
      'title', 'On-camera availability',
      'description', 'Determines whether production depends on the owner, team, or faceless formats.',
      'owner', 'client',
      'complete', coalesce(nullif(v_setup.on_camera_availability, ''), '') <> '',
      'priority', 'low'
    )
  );

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    insert into public.client_operations_checklist_items (
      agency_id,
      client_id,
      setup_id,
      item_key,
      section_key,
      title,
      description,
      owner,
      status,
      priority,
      due_at,
      resolved_at,
      source_kind,
      metadata
    )
    values (
      v_setup.agency_id,
      v_setup.client_id,
      v_setup.id,
      v_item->>'item_key',
      v_item->>'section_key',
      v_item->>'title',
      v_item->>'description',
      v_item->>'owner',
      case
        when coalesce((v_item->>'complete')::boolean, false) then 'done'
        when v_item->>'owner' = 'client' and v_item->>'priority' = 'high' then 'waiting_on_client'
        when v_item->>'owner' = 'shared' and v_item->>'priority' = 'high' then 'blocked'
        when v_item->>'owner' = 'agency' then 'in_progress'
        else 'todo'
      end,
      v_item->>'priority',
      null,
      case when coalesce((v_item->>'complete')::boolean, false) then now() else null end,
      'derived',
      jsonb_build_object('setup_status', v_setup.setup_status)
    )
    on conflict (client_id, item_key) do update set
      agency_id = excluded.agency_id,
      setup_id = excluded.setup_id,
      section_key = excluded.section_key,
      title = excluded.title,
      description = excluded.description,
      owner = excluded.owner,
      priority = excluded.priority,
      status = case
        when client_operations_checklist_items.source_kind = 'manual' then client_operations_checklist_items.status
        else excluded.status
      end,
      resolved_at = case
        when client_operations_checklist_items.source_kind = 'manual' then client_operations_checklist_items.resolved_at
        when excluded.status = 'done' then now()
        else null
      end,
      metadata = excluded.metadata,
      updated_at = now();

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'client_id', p_client_id,
    'items_synced', v_count
  );
end;
$$;

revoke all on function public.refresh_client_operations_checklist(uuid) from public;
grant execute on function public.refresh_client_operations_checklist(uuid) to authenticated;
grant execute on function public.refresh_client_operations_checklist(uuid) to service_role;

with existing_setup as (
  select client_id
  from public.client_operations_setup
)
select public.refresh_client_operations_checklist(client_id)
from existing_setup;
