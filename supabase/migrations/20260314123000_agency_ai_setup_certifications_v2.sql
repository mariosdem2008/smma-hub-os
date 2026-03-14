create table if not exists public.agency_ai_certifications_v2 (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  agent_class text not null,
  scenario_key text not null,
  scenario_title text not null,
  certification_state text not null default 'needs_review',
  latest_simulation_id uuid null references public.agency_ai_setup_simulations_v2(id) on delete set null,
  latest_result text not null default 'warn',
  latest_dimension_scores jsonb not null default '{}'::jsonb,
  latest_findings jsonb not null default '[]'::jsonb,
  recommended_next_action text null,
  certified_at timestamptz null,
  certified_by uuid null references auth.users(id) on delete set null,
  revoked_at timestamptz null,
  revoked_by uuid null references auth.users(id) on delete set null,
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agency_ai_certifications_v2_unique unique (agency_id, agent_class, scenario_key),
  constraint agency_ai_certifications_v2_state_check check (
    certification_state in ('needs_review', 'certified', 'revoked')
  ),
  constraint agency_ai_certifications_v2_result_check check (
    latest_result in ('pass', 'warn', 'fail')
  )
);

create table if not exists public.agency_ai_certification_events_v2 (
  id uuid primary key default gen_random_uuid(),
  certification_id uuid not null references public.agency_ai_certifications_v2(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  agent_class text not null,
  scenario_key text not null,
  event_type text not null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  simulation_id uuid null references public.agency_ai_setup_simulations_v2(id) on delete set null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint agency_ai_certification_events_v2_event_check check (
    event_type in ('simulation_linked', 'certified', 'revoked')
  )
);

drop trigger if exists agency_ai_certifications_v2_updated_at on public.agency_ai_certifications_v2;
create trigger agency_ai_certifications_v2_updated_at
before update on public.agency_ai_certifications_v2
for each row execute function public.set_updated_at_timestamp();

alter table public.agency_ai_certifications_v2 enable row level security;
alter table public.agency_ai_certification_events_v2 enable row level security;

drop policy if exists "agency_ai_certifications_v2_select_member" on public.agency_ai_certifications_v2;
create policy "agency_ai_certifications_v2_select_member"
on public.agency_ai_certifications_v2
for select
to authenticated
using (
  exists (
    select 1 from public.agency_members am
    where am.agency_id = agency_ai_certifications_v2.agency_id
      and am.user_id = auth.uid()
  )
  or exists (
    select 1 from public.agencies a
    where a.id = agency_ai_certifications_v2.agency_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "agency_ai_certifications_v2_write_admin" on public.agency_ai_certifications_v2;
create policy "agency_ai_certifications_v2_write_admin"
on public.agency_ai_certifications_v2
for all
to authenticated
using (
  exists (
    select 1 from public.agency_members am
    where am.agency_id = agency_ai_certifications_v2.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner', 'admin')
  )
  or exists (
    select 1 from public.agencies a
    where a.id = agency_ai_certifications_v2.agency_id
      and a.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.agency_members am
    where am.agency_id = agency_ai_certifications_v2.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner', 'admin')
  )
  or exists (
    select 1 from public.agencies a
    where a.id = agency_ai_certifications_v2.agency_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "agency_ai_certification_events_v2_select_member" on public.agency_ai_certification_events_v2;
create policy "agency_ai_certification_events_v2_select_member"
on public.agency_ai_certification_events_v2
for select
to authenticated
using (
  exists (
    select 1 from public.agency_members am
    where am.agency_id = agency_ai_certification_events_v2.agency_id
      and am.user_id = auth.uid()
  )
  or exists (
    select 1 from public.agencies a
    where a.id = agency_ai_certification_events_v2.agency_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "agency_ai_certification_events_v2_write_admin" on public.agency_ai_certification_events_v2;
create policy "agency_ai_certification_events_v2_write_admin"
on public.agency_ai_certification_events_v2
for all
to authenticated
using (
  exists (
    select 1 from public.agency_members am
    where am.agency_id = agency_ai_certification_events_v2.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner', 'admin')
  )
  or exists (
    select 1 from public.agencies a
    where a.id = agency_ai_certification_events_v2.agency_id
      and a.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.agency_members am
    where am.agency_id = agency_ai_certification_events_v2.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner', 'admin')
  )
  or exists (
    select 1 from public.agencies a
    where a.id = agency_ai_certification_events_v2.agency_id
      and a.user_id = auth.uid()
  )
);
