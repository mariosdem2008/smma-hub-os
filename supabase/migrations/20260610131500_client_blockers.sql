-- Latest deterministic blocker snapshot per client.
-- The scan edge function writes this table; UI reads it under agency-scoped RLS.

create table if not exists public.client_blockers (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  delivery_state text not null default 'on_track'
    check (delivery_state in ('on_track', 'at_risk', 'blocked')),
  blockers jsonb not null default '[]'::jsonb,
  counts jsonb not null default '{"high":0,"med":0,"blocked":0}'::jsonb,
  scanned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id)
);

create index if not exists idx_client_blockers_agency
  on public.client_blockers (agency_id, delivery_state, scanned_at desc);

create index if not exists idx_client_blockers_client_scanned
  on public.client_blockers (client_id, scanned_at desc);

alter table public.client_blockers enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'client_blockers'
      and policyname = 'client_blockers_select'
  ) then
    execute $policy$
      create policy "client_blockers_select"
      on public.client_blockers
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = client_blockers.agency_id
            and am.user_id = auth.uid()
        )
      );
    $policy$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'client_blockers'
      and policyname = 'client_blockers_admin_write'
  ) then
    execute $policy$
      create policy "client_blockers_admin_write"
      on public.client_blockers
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = client_blockers.agency_id
            and am.user_id = auth.uid()
            and am.role in ('owner', 'admin')
        )
      )
      with check (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = client_blockers.agency_id
            and am.user_id = auth.uid()
            and am.role in ('owner', 'admin')
        )
      );
    $policy$;
  end if;
end $$;

drop trigger if exists client_blockers_updated_at on public.client_blockers;
create trigger client_blockers_updated_at
  before update on public.client_blockers
  for each row
  execute function public.update_updated_at_column();

revoke all on table public.client_blockers from public;
revoke all on table public.client_blockers from anon;
grant select, insert, update, delete on table public.client_blockers to authenticated;
grant all on table public.client_blockers to service_role;
