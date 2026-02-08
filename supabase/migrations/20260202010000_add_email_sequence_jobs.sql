-- Queue table for email sequence dispatch (Phase 1)
create table if not exists public.email_sequence_jobs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  sequence_id text not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_sequence_jobs enable row level security;

-- Prevent duplicate active jobs for same sequence.
create unique index if not exists email_sequence_jobs_active_unique
  on public.email_sequence_jobs (agency_id, client_id, sequence_id)
  where status in ('pending','processing');

create index if not exists email_sequence_jobs_status_idx
  on public.email_sequence_jobs (status, created_at desc);

create index if not exists email_sequence_jobs_agency_idx
  on public.email_sequence_jobs (agency_id, created_at desc);

-- RLS: agency members can view their own agency's email sequence jobs.
create policy "email_sequence_jobs_select_agency"
  on public.email_sequence_jobs
  for select
  using (
    agency_id in (
      select agency_id from public.agency_members where user_id = auth.uid()
    )
  );

-- Service role writes (edge functions) bypass RLS; no insert/update policy needed for end users.
