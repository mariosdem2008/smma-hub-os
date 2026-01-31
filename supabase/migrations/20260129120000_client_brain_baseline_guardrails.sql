-- Phase 0: ClientBrain baseline guardrails
-- Ensures every client has a baseline client_brains row and prevents duplicates.

-- 1) De-duplicate any accidental duplicates (keep newest per (agency_id, client_id, version))
with ranked as (
  select
    id,
    row_number() over (
      partition by agency_id, client_id, version
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.client_brains
)
delete from public.client_brains cb
using ranked r
where cb.id = r.id
  and r.rn > 1;

-- 2) Backfill baseline brain rows for existing clients missing any brain row
insert into public.client_brains (
  agency_id,
  client_id,
  version,
  status,
  locked,
  usable,
  brain_json,
  json_diff,
  confidence,
  created_at,
  updated_at
)
select
  c.agency_id,
  c.id as client_id,
  1 as version,
  'draft' as status,
  false as locked,
  false as usable,
  '{}'::jsonb as brain_json,
  null::jsonb as json_diff,
  0 as confidence,
  now() as created_at,
  now() as updated_at
from public.clients c
where not exists (
  select 1
  from public.client_brains cb
  where cb.client_id = c.id
);

-- 3) Enforce uniqueness per version
create unique index if not exists idx_client_brains_agency_client_version_unique
  on public.client_brains (agency_id, client_id, version);

-- 4) Automatically create a baseline brain row for every new client
create or replace function public.ensure_client_brain_baseline_on_client_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.client_brains (
    agency_id,
    client_id,
    version,
    status,
    locked,
    usable,
    brain_json,
    json_diff,
    confidence
  )
  select
    new.agency_id,
    new.id,
    1,
    'draft',
    false,
    false,
    '{}'::jsonb,
    null::jsonb,
    0
  where not exists (
    select 1
    from public.client_brains cb
    where cb.client_id = new.id
  );

  return new;
end;
$$;

drop trigger if exists trg_clients_ensure_client_brain_baseline on public.clients;
create trigger trg_clients_ensure_client_brain_baseline
after insert on public.clients
for each row
execute function public.ensure_client_brain_baseline_on_client_insert();

