-- Client onboarding sessions for AI-guided onboarding v3
-- Stores SAFE normalized answers for cross-device resume (NO brain_json)

create table if not exists public.client_onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  brain_id uuid not null,
  step_id text not null,
  answers_json jsonb not null default '{}',
  completed_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_session_per_client unique (client_id)
);

create index if not exists idx_onboarding_sessions_agency_client on public.client_onboarding_sessions(agency_id, client_id);
create index if not exists idx_onboarding_sessions_user on public.client_onboarding_sessions(user_id, updated_at);

alter table public.client_onboarding_sessions enable row level security;

-- RLS: Only agency members can select/insert/update their own agency's sessions
create policy "onboarding_sessions_select" on public.client_onboarding_sessions
  for select to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "onboarding_sessions_insert" on public.client_onboarding_sessions
  for insert to authenticated
  with check (
    agency_id in (select agency_id from public.agency_members where user_id = auth.uid())
    and user_id = auth.uid()
  );

create policy "onboarding_sessions_update" on public.client_onboarding_sessions
  for update to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "onboarding_sessions_delete" on public.client_onboarding_sessions
  for delete to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

-- Trigger to auto-update updated_at
create or replace function public.update_onboarding_session_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_onboarding_session_timestamp
  before update on public.client_onboarding_sessions
  for each row
  execute function public.update_onboarding_session_timestamp();
