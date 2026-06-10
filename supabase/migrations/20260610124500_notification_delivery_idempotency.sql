-- Durable delivery markers for approval-related emails.
-- Used by edge functions to make Resend delivery idempotent across retries.

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  channel text not null default 'email' check (channel in ('email')),
  action text not null,
  idempotency_key text not null,
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed', 'skipped')),
  attempt_count integer not null default 1,
  request_payload jsonb not null default '{}'::jsonb,
  provider_response jsonb not null default '{}'::jsonb,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_deliveries_idempotency_key_unique unique (idempotency_key)
);

create index if not exists idx_notification_deliveries_agency_created
  on public.notification_deliveries (agency_id, created_at desc);

create index if not exists idx_notification_deliveries_project_action_sent
  on public.notification_deliveries (project_id, action, sent_at desc)
  where project_id is not null;

alter table public.notification_deliveries enable row level security;

grant all on table public.notification_deliveries to service_role;
grant select on table public.notification_deliveries to authenticated;

drop policy if exists "notification_deliveries_select_agency_members" on public.notification_deliveries;
create policy "notification_deliveries_select_agency_members"
on public.notification_deliveries
for select
to authenticated
using (public.is_member_of_agency(agency_id));

drop trigger if exists update_notification_deliveries_updated_at on public.notification_deliveries;
create trigger update_notification_deliveries_updated_at
before update on public.notification_deliveries
for each row
execute function public.update_updated_at_column();
