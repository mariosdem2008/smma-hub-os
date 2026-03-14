create table if not exists public.agency_ai_setup_status_v2 (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  current_stage text not null default 'overview',
  current_step text not null default 'overview',
  setup_state text not null default 'not_started',
  started_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  completed_foundations_at timestamptz null,
  completed_readiness_review_at timestamptz null,
  activated_at timestamptz null,
  control_center_enabled_at timestamptz null,
  meta_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agency_ai_setup_status_v2_setup_state_check check (
    setup_state in ('not_started', 'in_progress', 'ready_for_review', 'active')
  )
);

create table if not exists public.agency_ai_readiness_scores_v2 (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  score_version integer not null default 1,
  knowledge_coverage integer not null default 0,
  process_definition integer not null default 0,
  quality_definition integer not null default 0,
  compliance_safety integer not null default 0,
  approval_governance integer not null default 0,
  evidence_strength integer not null default 0,
  overall_label text not null default 'Not Ready',
  critical_blockers jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  computed_from_json jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agency_ai_readiness_scores_v2_score_bounds check (
    knowledge_coverage between 0 and 100
    and process_definition between 0 and 100
    and quality_definition between 0 and 100
    and compliance_safety between 0 and 100
    and approval_governance between 0 and 100
    and evidence_strength between 0 and 100
  )
);

create table if not exists public.agency_agent_unlocks_v2 (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  agent_class text not null,
  unlock_state text not null default 'blocked',
  blocked_reasons jsonb not null default '[]'::jsonb,
  required_modules jsonb not null default '[]'::jsonb,
  minimum_scores_json jsonb not null default '{}'::jsonb,
  last_evaluated_at timestamptz not null default now(),
  activated_at timestamptz null,
  activated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (agency_id, agent_class),
  constraint agency_agent_unlocks_v2_unlock_state_check check (
    unlock_state in ('blocked', 'preview_only', 'internal_assist_only', 'operational')
  )
);

create table if not exists public.agency_operating_module_reviews_v2 (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  module_key text not null,
  module_version integer not null default 1,
  decision text not null,
  note text null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint agency_operating_module_reviews_v2_decision_check check (
    decision in ('approved', 'changes_requested', 'rejected')
  )
);

create table if not exists public.agency_ai_setup_simulations_v2 (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  agent_class text not null,
  input_snapshot_json jsonb not null default '{}'::jsonb,
  output_snapshot_json jsonb not null default '{}'::jsonb,
  evaluation_json jsonb not null default '{}'::jsonb,
  result text not null default 'warn',
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint agency_ai_setup_simulations_v2_result_check check (
    result in ('pass', 'warn', 'fail')
  )
);

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agency_ai_setup_status_v2_updated_at on public.agency_ai_setup_status_v2;
create trigger agency_ai_setup_status_v2_updated_at
before update on public.agency_ai_setup_status_v2
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists agency_ai_readiness_scores_v2_updated_at on public.agency_ai_readiness_scores_v2;
create trigger agency_ai_readiness_scores_v2_updated_at
before update on public.agency_ai_readiness_scores_v2
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists agency_agent_unlocks_v2_updated_at on public.agency_agent_unlocks_v2;
create trigger agency_agent_unlocks_v2_updated_at
before update on public.agency_agent_unlocks_v2
for each row execute function public.set_updated_at_timestamp();

alter table public.agency_ai_setup_status_v2 enable row level security;
alter table public.agency_ai_readiness_scores_v2 enable row level security;
alter table public.agency_agent_unlocks_v2 enable row level security;
alter table public.agency_operating_module_reviews_v2 enable row level security;
alter table public.agency_ai_setup_simulations_v2 enable row level security;

drop policy if exists "agency_ai_setup_status_v2_select_member" on public.agency_ai_setup_status_v2;
create policy "agency_ai_setup_status_v2_select_member"
on public.agency_ai_setup_status_v2
for select
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = agency_ai_setup_status_v2.agency_id
      and am.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.agencies a
    where a.id = agency_ai_setup_status_v2.agency_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "agency_ai_setup_status_v2_write_admin" on public.agency_ai_setup_status_v2;
create policy "agency_ai_setup_status_v2_write_admin"
on public.agency_ai_setup_status_v2
for all
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = agency_ai_setup_status_v2.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.agencies a
    where a.id = agency_ai_setup_status_v2.agency_id
      and a.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = agency_ai_setup_status_v2.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.agencies a
    where a.id = agency_ai_setup_status_v2.agency_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "agency_ai_readiness_scores_v2_select_member" on public.agency_ai_readiness_scores_v2;
create policy "agency_ai_readiness_scores_v2_select_member"
on public.agency_ai_readiness_scores_v2
for select
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = agency_ai_readiness_scores_v2.agency_id
      and am.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.agencies a
    where a.id = agency_ai_readiness_scores_v2.agency_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "agency_ai_readiness_scores_v2_write_admin" on public.agency_ai_readiness_scores_v2;
create policy "agency_ai_readiness_scores_v2_write_admin"
on public.agency_ai_readiness_scores_v2
for all
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = agency_ai_readiness_scores_v2.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.agencies a
    where a.id = agency_ai_readiness_scores_v2.agency_id
      and a.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = agency_ai_readiness_scores_v2.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.agencies a
    where a.id = agency_ai_readiness_scores_v2.agency_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "agency_agent_unlocks_v2_select_member" on public.agency_agent_unlocks_v2;
create policy "agency_agent_unlocks_v2_select_member"
on public.agency_agent_unlocks_v2
for select
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = agency_agent_unlocks_v2.agency_id
      and am.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.agencies a
    where a.id = agency_agent_unlocks_v2.agency_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "agency_agent_unlocks_v2_write_admin" on public.agency_agent_unlocks_v2;
create policy "agency_agent_unlocks_v2_write_admin"
on public.agency_agent_unlocks_v2
for all
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = agency_agent_unlocks_v2.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.agencies a
    where a.id = agency_agent_unlocks_v2.agency_id
      and a.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = agency_agent_unlocks_v2.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.agencies a
    where a.id = agency_agent_unlocks_v2.agency_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "agency_operating_module_reviews_v2_select_member" on public.agency_operating_module_reviews_v2;
create policy "agency_operating_module_reviews_v2_select_member"
on public.agency_operating_module_reviews_v2
for select
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = agency_operating_module_reviews_v2.agency_id
      and am.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.agencies a
    where a.id = agency_operating_module_reviews_v2.agency_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "agency_operating_module_reviews_v2_write_admin" on public.agency_operating_module_reviews_v2;
create policy "agency_operating_module_reviews_v2_write_admin"
on public.agency_operating_module_reviews_v2
for all
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = agency_operating_module_reviews_v2.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.agencies a
    where a.id = agency_operating_module_reviews_v2.agency_id
      and a.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = agency_operating_module_reviews_v2.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.agencies a
    where a.id = agency_operating_module_reviews_v2.agency_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "agency_ai_setup_simulations_v2_select_member" on public.agency_ai_setup_simulations_v2;
create policy "agency_ai_setup_simulations_v2_select_member"
on public.agency_ai_setup_simulations_v2
for select
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = agency_ai_setup_simulations_v2.agency_id
      and am.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.agencies a
    where a.id = agency_ai_setup_simulations_v2.agency_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "agency_ai_setup_simulations_v2_write_admin" on public.agency_ai_setup_simulations_v2;
create policy "agency_ai_setup_simulations_v2_write_admin"
on public.agency_ai_setup_simulations_v2
for all
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = agency_ai_setup_simulations_v2.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.agencies a
    where a.id = agency_ai_setup_simulations_v2.agency_id
      and a.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = agency_ai_setup_simulations_v2.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.agencies a
    where a.id = agency_ai_setup_simulations_v2.agency_id
      and a.user_id = auth.uid()
  )
);
