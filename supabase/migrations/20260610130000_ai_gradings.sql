-- Audit trail for governed AI grading decisions.
-- Edge functions write through service_role; authenticated users can only read
-- rows for agencies they belong to. No anon grants are provided.

create table if not exists public.ai_gradings (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  content_type text not null default 'unknown',
  surface text not null default 'unknown',
  score integer not null check (score between 0 and 100),
  accepted boolean not null,
  hard_violations jsonb not null default '[]'::jsonb,
  soft_issues jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_gradings_agency_created
  on public.ai_gradings (agency_id, created_at desc);

create index if not exists idx_ai_gradings_client_created
  on public.ai_gradings (client_id, created_at desc)
  where client_id is not null;

create index if not exists idx_ai_gradings_agency_acceptance
  on public.ai_gradings (agency_id, accepted, created_at desc);

alter table public.ai_gradings enable row level security;

revoke all on table public.ai_gradings from anon;
grant select on table public.ai_gradings to authenticated;
grant all on table public.ai_gradings to service_role;

drop policy if exists "ai_gradings_select_agency_members" on public.ai_gradings;
create policy "ai_gradings_select_agency_members"
on public.ai_gradings
for select
to authenticated
using (public.is_member_of_agency(agency_id));
