create table if not exists public.client_onboarding_chat_turn_logs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  turn_id text not null,
  mode text not null,
  card_id text null,
  intent text null,
  user_message text null,
  card_payload_json jsonb null default '{}'::jsonb,
  validation_errors_json jsonb null default '[]'::jsonb,
  assistant_text text not null,
  progress_json jsonb not null default '{}'::jsonb,
  blockers_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_onboarding_chat_turn_logs_agency_created
  on public.client_onboarding_chat_turn_logs (agency_id, created_at desc);

create index if not exists idx_client_onboarding_chat_turn_logs_client_created
  on public.client_onboarding_chat_turn_logs (client_id, created_at desc);

create index if not exists idx_client_onboarding_chat_turn_logs_turn_id
  on public.client_onboarding_chat_turn_logs (turn_id);

alter table public.client_onboarding_chat_turn_logs enable row level security;

drop policy if exists "client_onboarding_chat_turn_logs_select_member" on public.client_onboarding_chat_turn_logs;
create policy "client_onboarding_chat_turn_logs_select_member"
on public.client_onboarding_chat_turn_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = client_onboarding_chat_turn_logs.agency_id
      and am.user_id = auth.uid()
  )
);

drop policy if exists "client_onboarding_chat_turn_logs_insert_member" on public.client_onboarding_chat_turn_logs;
create policy "client_onboarding_chat_turn_logs_insert_member"
on public.client_onboarding_chat_turn_logs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = client_onboarding_chat_turn_logs.agency_id
      and am.user_id = auth.uid()
  )
);

grant select, insert on public.client_onboarding_chat_turn_logs to authenticated;
grant select, insert, update, delete on public.client_onboarding_chat_turn_logs to service_role;
