-- Durable executor checkpoints (Phase 1)

create table if not exists public.ai_executor_checkpoints (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null,
  step_id text not null,
  status text not null,
  agency_id uuid references public.agencies(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_executor_checkpoints_plan on public.ai_executor_checkpoints(plan_id, created_at);
create index if not exists idx_ai_executor_checkpoints_agency on public.ai_executor_checkpoints(agency_id, created_at);

alter table public.ai_executor_checkpoints enable row level security;

create policy "ai_executor_checkpoints_select" on public.ai_executor_checkpoints
  for select to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_executor_checkpoints_insert" on public.ai_executor_checkpoints
  for insert to authenticated
  with check (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_executor_checkpoints_update" on public.ai_executor_checkpoints
  for update to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_executor_checkpoints_delete" on public.ai_executor_checkpoints
  for delete to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));
