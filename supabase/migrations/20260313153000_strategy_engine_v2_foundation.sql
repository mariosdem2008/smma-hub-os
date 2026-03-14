-- Strategy Engine V2 foundation: operating modules, briefs, artifacts, approvals, runs, evaluations

do $$ begin
  create type public.v2_module_status as enum ('draft', 'review', 'approved', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.v2_readiness_state as enum (
    'insufficient',
    'diagnosis_ready',
    'strategy_ready_with_caveats',
    'strategy_ready',
    'execution_ready'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.v2_artifact_type as enum (
    'strategy_readiness_audit',
    'strategy_diagnosis',
    'strategy_recommendation',
    'strategy_plan_v2',
    'creator_brief',
    'strategy_reconciliation'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.v2_artifact_status as enum (
    'draft',
    'review',
    'approved',
    'rejected',
    'superseded',
    'archived'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.v2_agent_run_status as enum (
    'started',
    'completed',
    'failed',
    'blocked',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.v2_evaluation_result as enum ('pass', 'warn', 'fail');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.agency_operating_modules_v2 (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  source_document_id uuid references public.brain_documents(id) on delete set null,
  module_key text not null,
  version integer not null default 1,
  status public.v2_module_status not null default 'draft',
  approval_owner_user_id uuid references auth.users(id),
  approved_by_user_id uuid references auth.users(id),
  approved_at timestamptz,
  content_json jsonb not null default '{}'::jsonb,
  derived_snapshot_json jsonb not null default '{}'::jsonb,
  confidence integer,
  evidence_sources jsonb not null default '[]'::jsonb,
  last_reviewed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, module_key, version)
);

create table if not exists public.client_operating_briefs_v2 (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  version integer not null default 1,
  readiness_state public.v2_readiness_state not null default 'insufficient',
  status text not null default 'draft' check (status in ('draft', 'review', 'approved', 'superseded')),
  source_onboarding_profile_id uuid references public.client_onboarding_profiles(id) on delete set null,
  source_client_brain_id uuid references public.client_brains(id) on delete set null,
  source_operations_setup_id uuid references public.client_operations_setup(id) on delete set null,
  content_json jsonb not null default '{}'::jsonb,
  missing_items jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  confidence integer,
  approved_by_user_id uuid references auth.users(id),
  approved_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, version)
);

create table if not exists public.strategy_artifacts_v2 (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  artifact_type public.v2_artifact_type not null,
  version integer not null default 1,
  status public.v2_artifact_status not null default 'draft',
  source_brief_id uuid references public.client_operating_briefs_v2(id) on delete set null,
  source_agency_module_version_map jsonb not null default '{}'::jsonb,
  supersedes_artifact_id uuid references public.strategy_artifacts_v2(id) on delete set null,
  content_json jsonb not null default '{}'::jsonb,
  markdown text,
  citations jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  open_questions jsonb not null default '[]'::jsonb,
  confidence integer,
  generated_by_run_id uuid,
  approved_by_user_id uuid references auth.users(id),
  approved_at timestamptz,
  published_to_strategy_id uuid references public.strategies(id) on delete set null,
  published_to_document_id uuid references public.strategy_documents(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategy_artifact_approvals_v2 (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.strategy_artifacts_v2(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  approval_stage text not null,
  decision text not null check (decision in ('approved', 'rejected', 'changes_requested')),
  note text,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.agent_runs_v2 (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  agent_key text not null,
  run_status public.v2_agent_run_status not null default 'started',
  lifecycle_state text,
  input_refs jsonb not null default '{}'::jsonb,
  output_artifact_id uuid references public.strategy_artifacts_v2(id) on delete set null,
  model text,
  tokens_in integer,
  tokens_out integer,
  cost_usd numeric(12, 6),
  duration_ms integer,
  failure_reason text,
  trace_json jsonb not null default '{}'::jsonb,
  started_by_user_id uuid references auth.users(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.artifact_evaluations_v2 (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.strategy_artifacts_v2(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  evaluator_key text not null,
  result public.v2_evaluation_result not null,
  score integer,
  findings jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_agency_operating_modules_v2_agency_status on public.agency_operating_modules_v2 (agency_id, status, updated_at desc);
create index if not exists idx_agency_operating_modules_v2_agency_module on public.agency_operating_modules_v2 (agency_id, module_key, version desc);
create index if not exists idx_client_operating_briefs_v2_client_state on public.client_operating_briefs_v2 (client_id, readiness_state, updated_at desc);
create index if not exists idx_strategy_artifacts_v2_client_type_version on public.strategy_artifacts_v2 (client_id, artifact_type, version desc);
create index if not exists idx_strategy_artifacts_v2_client_status on public.strategy_artifacts_v2 (client_id, status, updated_at desc);
create index if not exists idx_strategy_artifact_approvals_v2_artifact on public.strategy_artifact_approvals_v2 (artifact_id, created_at desc);
create index if not exists idx_agent_runs_v2_client_agent on public.agent_runs_v2 (client_id, agent_key, started_at desc);
create index if not exists idx_artifact_evaluations_v2_artifact on public.artifact_evaluations_v2 (artifact_id, created_at desc);

create or replace function public.update_v2_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_agency_operating_modules_v2_updated_at on public.agency_operating_modules_v2;
create trigger trg_agency_operating_modules_v2_updated_at
  before update on public.agency_operating_modules_v2
  for each row execute function public.update_v2_updated_at();

drop trigger if exists trg_client_operating_briefs_v2_updated_at on public.client_operating_briefs_v2;
create trigger trg_client_operating_briefs_v2_updated_at
  before update on public.client_operating_briefs_v2
  for each row execute function public.update_v2_updated_at();

drop trigger if exists trg_strategy_artifacts_v2_updated_at on public.strategy_artifacts_v2;
create trigger trg_strategy_artifacts_v2_updated_at
  before update on public.strategy_artifacts_v2
  for each row execute function public.update_v2_updated_at();

alter table public.agency_operating_modules_v2 enable row level security;
alter table public.client_operating_briefs_v2 enable row level security;
alter table public.strategy_artifacts_v2 enable row level security;
alter table public.strategy_artifact_approvals_v2 enable row level security;
alter table public.agent_runs_v2 enable row level security;
alter table public.artifact_evaluations_v2 enable row level security;

create policy agency_operating_modules_v2_select on public.agency_operating_modules_v2
  for select using (
    exists (
      select 1 from public.agency_members am
      where am.agency_id = agency_operating_modules_v2.agency_id
        and am.user_id = auth.uid()
    )
  );

create policy agency_operating_modules_v2_insert on public.agency_operating_modules_v2
  for insert with check (
    exists (
      select 1 from public.agency_members am
      where am.agency_id = agency_operating_modules_v2.agency_id
        and am.user_id = auth.uid()
    )
  );

create policy agency_operating_modules_v2_update on public.agency_operating_modules_v2
  for update using (
    exists (
      select 1 from public.agency_members am
      where am.agency_id = agency_operating_modules_v2.agency_id
        and am.user_id = auth.uid()
    )
  );

create policy client_operating_briefs_v2_select on public.client_operating_briefs_v2
  for select using (
    exists (
      select 1 from public.agency_members am
      where am.agency_id = client_operating_briefs_v2.agency_id
        and am.user_id = auth.uid()
    )
  );

create policy client_operating_briefs_v2_insert on public.client_operating_briefs_v2
  for insert with check (
    exists (
      select 1 from public.agency_members am
      where am.agency_id = client_operating_briefs_v2.agency_id
        and am.user_id = auth.uid()
    )
  );

create policy client_operating_briefs_v2_update on public.client_operating_briefs_v2
  for update using (
    exists (
      select 1 from public.agency_members am
      where am.agency_id = client_operating_briefs_v2.agency_id
        and am.user_id = auth.uid()
    )
  );

create policy strategy_artifacts_v2_select on public.strategy_artifacts_v2
  for select using (
    exists (
      select 1 from public.agency_members am
      where am.agency_id = strategy_artifacts_v2.agency_id
        and am.user_id = auth.uid()
    )
  );

create policy strategy_artifacts_v2_insert on public.strategy_artifacts_v2
  for insert with check (
    exists (
      select 1 from public.agency_members am
      where am.agency_id = strategy_artifacts_v2.agency_id
        and am.user_id = auth.uid()
    )
  );

create policy strategy_artifacts_v2_update on public.strategy_artifacts_v2
  for update using (
    exists (
      select 1 from public.agency_members am
      where am.agency_id = strategy_artifacts_v2.agency_id
        and am.user_id = auth.uid()
    )
  );

create policy strategy_artifact_approvals_v2_select on public.strategy_artifact_approvals_v2
  for select using (
    exists (
      select 1 from public.agency_members am
      where am.agency_id = strategy_artifact_approvals_v2.agency_id
        and am.user_id = auth.uid()
    )
  );

create policy strategy_artifact_approvals_v2_insert on public.strategy_artifact_approvals_v2
  for insert with check (
    exists (
      select 1 from public.agency_members am
      where am.agency_id = strategy_artifact_approvals_v2.agency_id
        and am.user_id = auth.uid()
    )
  );

create policy agent_runs_v2_select on public.agent_runs_v2
  for select using (
    exists (
      select 1 from public.agency_members am
      where am.agency_id = agent_runs_v2.agency_id
        and am.user_id = auth.uid()
    )
  );

create policy agent_runs_v2_insert on public.agent_runs_v2
  for insert with check (
    exists (
      select 1 from public.agency_members am
      where am.agency_id = agent_runs_v2.agency_id
        and am.user_id = auth.uid()
    )
  );

create policy artifact_evaluations_v2_select on public.artifact_evaluations_v2
  for select using (
    exists (
      select 1 from public.agency_members am
      where am.agency_id = artifact_evaluations_v2.agency_id
        and am.user_id = auth.uid()
    )
  );

create policy artifact_evaluations_v2_insert on public.artifact_evaluations_v2
  for insert with check (
    exists (
      select 1 from public.agency_members am
      where am.agency_id = artifact_evaluations_v2.agency_id
        and am.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.agency_operating_modules_v2 to authenticated;
grant select, insert, update, delete on public.client_operating_briefs_v2 to authenticated;
grant select, insert, update, delete on public.strategy_artifacts_v2 to authenticated;
grant select, insert, update, delete on public.strategy_artifact_approvals_v2 to authenticated;
grant select, insert, update, delete on public.agent_runs_v2 to authenticated;
grant select, insert, update, delete on public.artifact_evaluations_v2 to authenticated;

grant all on public.agency_operating_modules_v2 to service_role;
grant all on public.client_operating_briefs_v2 to service_role;
grant all on public.strategy_artifacts_v2 to service_role;
grant all on public.strategy_artifact_approvals_v2 to service_role;
grant all on public.agent_runs_v2 to service_role;
grant all on public.artifact_evaluations_v2 to service_role;
