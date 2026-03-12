create table if not exists public.client_onboarding_v3_states (
  client_id uuid primary key references public.clients(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  state_doc jsonb not null default '{}'::jsonb,
  state_version text not null default 'init',
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_onboarding_v3_states_agency_id
  on public.client_onboarding_v3_states (agency_id);

create index if not exists idx_client_onboarding_v3_states_updated_at
  on public.client_onboarding_v3_states (updated_at desc);

alter table public.client_onboarding_v3_states enable row level security;

drop policy if exists "client_onboarding_v3_states_select_member" on public.client_onboarding_v3_states;
create policy "client_onboarding_v3_states_select_member"
on public.client_onboarding_v3_states
for select
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = client_onboarding_v3_states.agency_id
      and am.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.agencies a
    where a.id = client_onboarding_v3_states.agency_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "client_onboarding_v3_states_write_member" on public.client_onboarding_v3_states;
create policy "client_onboarding_v3_states_write_member"
on public.client_onboarding_v3_states
for all
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = client_onboarding_v3_states.agency_id
      and am.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.agencies a
    where a.id = client_onboarding_v3_states.agency_id
      and a.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = client_onboarding_v3_states.agency_id
      and am.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.agencies a
    where a.id = client_onboarding_v3_states.agency_id
      and a.user_id = auth.uid()
  )
);

grant select, insert, update, delete on public.client_onboarding_v3_states to authenticated;
grant select, insert, update, delete on public.client_onboarding_v3_states to service_role;
