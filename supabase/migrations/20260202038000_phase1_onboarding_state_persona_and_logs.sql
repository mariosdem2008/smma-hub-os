-- Phase 1: onboarding completion state + persona vectors + raw onboarding turn logs
-- Goal: establish tenant-safe persistence primitives required by the AI-guided onboarding blueprint.

-- 1) Onboarding completion state
create table if not exists public.ai_onboarding_status (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  scope text not null default 'agency' check (scope in ('agency', 'client')),
  status text not null default 'in_progress' check (status in ('not_started', 'in_progress', 'complete', 'blocked')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  last_step_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope = 'agency' and client_id is null)
    or (scope = 'client' and client_id is not null)
  ),
  check (
    (status = 'complete' and completed_at is not null)
    or (status <> 'complete')
  )
);

create unique index if not exists idx_ai_onboarding_status_unique_agency_scope
  on public.ai_onboarding_status(agency_id)
  where client_id is null;

create unique index if not exists idx_ai_onboarding_status_unique_client_scope
  on public.ai_onboarding_status(agency_id, client_id)
  where client_id is not null;

create index if not exists idx_ai_onboarding_status_agency_updated
  on public.ai_onboarding_status(agency_id, updated_at desc);

-- 2) Persona vectors (assistant name + tone + expertise traits)
create table if not exists public.ai_persona_vectors (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  scope text not null default 'agency' check (scope in ('agency', 'client')),
  assistant_name text not null default 'Alex',
  tone_traits jsonb not null default '[]'::jsonb,
  expertise_traits jsonb not null default '[]'::jsonb,
  persona_metadata jsonb not null default '{}'::jsonb,
  source text not null default 'default',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(trim(assistant_name)) > 0),
  check (
    (scope = 'agency' and client_id is null)
    or (scope = 'client' and client_id is not null)
  )
);

create unique index if not exists idx_ai_persona_vectors_unique_agency_scope
  on public.ai_persona_vectors(agency_id)
  where client_id is null;

create unique index if not exists idx_ai_persona_vectors_unique_client_scope
  on public.ai_persona_vectors(agency_id, client_id)
  where client_id is not null;

create index if not exists idx_ai_persona_vectors_agency_updated
  on public.ai_persona_vectors(agency_id, updated_at desc);

-- 3) Raw onboarding turn logs (episodic record of onboarding chat)
create table if not exists public.ai_onboarding_turn_logs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  onboarding_status_id uuid references public.ai_onboarding_status(id) on delete set null,
  scope text not null default 'agency' check (scope in ('agency', 'client')),
  turn_index integer not null check (turn_index >= 0),
  step_id text,
  user_message text,
  assistant_message text,
  messages_json jsonb not null default '[]'::jsonb,
  snapshot_json jsonb not null default '{}'::jsonb,
  trace_id text,
  span_id text,
  source_endpoint text not null default 'ai-onboarding',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (scope = 'agency' and client_id is null)
    or (scope = 'client' and client_id is not null)
  )
);

create index if not exists idx_ai_onboarding_turn_logs_scope_created
  on public.ai_onboarding_turn_logs(agency_id, client_id, created_at desc);

create index if not exists idx_ai_onboarding_turn_logs_trace
  on public.ai_onboarding_turn_logs(trace_id);

-- 4) Timestamp triggers
drop trigger if exists trg_ai_onboarding_status_updated_at on public.ai_onboarding_status;
create trigger trg_ai_onboarding_status_updated_at
  before update on public.ai_onboarding_status
  for each row execute function public.update_updated_at_column();

drop trigger if exists trg_ai_persona_vectors_updated_at on public.ai_persona_vectors;
create trigger trg_ai_persona_vectors_updated_at
  before update on public.ai_persona_vectors
  for each row execute function public.update_updated_at_column();

-- 5) RLS
alter table public.ai_onboarding_status enable row level security;
alter table public.ai_persona_vectors enable row level security;
alter table public.ai_onboarding_turn_logs enable row level security;

-- ai_onboarding_status policies
drop policy if exists "ai_onboarding_status_select" on public.ai_onboarding_status;
create policy "ai_onboarding_status_select" on public.ai_onboarding_status
  for select to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

drop policy if exists "ai_onboarding_status_insert" on public.ai_onboarding_status;
create policy "ai_onboarding_status_insert" on public.ai_onboarding_status
  for insert to authenticated
  with check (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

drop policy if exists "ai_onboarding_status_update" on public.ai_onboarding_status;
create policy "ai_onboarding_status_update" on public.ai_onboarding_status
  for update to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()))
  with check (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

drop policy if exists "ai_onboarding_status_delete" on public.ai_onboarding_status;
create policy "ai_onboarding_status_delete" on public.ai_onboarding_status
  for delete to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

-- ai_persona_vectors policies
drop policy if exists "ai_persona_vectors_select" on public.ai_persona_vectors;
create policy "ai_persona_vectors_select" on public.ai_persona_vectors
  for select to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

drop policy if exists "ai_persona_vectors_insert" on public.ai_persona_vectors;
create policy "ai_persona_vectors_insert" on public.ai_persona_vectors
  for insert to authenticated
  with check (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

drop policy if exists "ai_persona_vectors_update" on public.ai_persona_vectors;
create policy "ai_persona_vectors_update" on public.ai_persona_vectors
  for update to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()))
  with check (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

drop policy if exists "ai_persona_vectors_delete" on public.ai_persona_vectors;
create policy "ai_persona_vectors_delete" on public.ai_persona_vectors
  for delete to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

-- ai_onboarding_turn_logs policies
drop policy if exists "ai_onboarding_turn_logs_select" on public.ai_onboarding_turn_logs;
create policy "ai_onboarding_turn_logs_select" on public.ai_onboarding_turn_logs
  for select to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

drop policy if exists "ai_onboarding_turn_logs_insert" on public.ai_onboarding_turn_logs;
create policy "ai_onboarding_turn_logs_insert" on public.ai_onboarding_turn_logs
  for insert to authenticated
  with check (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

drop policy if exists "ai_onboarding_turn_logs_update" on public.ai_onboarding_turn_logs;
create policy "ai_onboarding_turn_logs_update" on public.ai_onboarding_turn_logs
  for update to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()))
  with check (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

drop policy if exists "ai_onboarding_turn_logs_delete" on public.ai_onboarding_turn_logs;
create policy "ai_onboarding_turn_logs_delete" on public.ai_onboarding_turn_logs
  for delete to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

grant select, insert, update, delete on table public.ai_onboarding_status to authenticated;
grant select, insert, update, delete on table public.ai_persona_vectors to authenticated;
grant select, insert, update, delete on table public.ai_onboarding_turn_logs to authenticated;

