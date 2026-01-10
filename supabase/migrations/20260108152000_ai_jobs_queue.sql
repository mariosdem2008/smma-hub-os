-- AI Jobs queue for async strategy seeding

create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  job_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  dedupe_key text,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'failed')),
  attempts integer not null default 0,
  run_after timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_jobs_status_run_after_idx
  on public.ai_jobs (status, run_after, created_at);

create index if not exists ai_jobs_agency_created_idx
  on public.ai_jobs (agency_id, created_at desc);

create unique index if not exists ai_jobs_dedupe_unique
  on public.ai_jobs (job_type, client_id, dedupe_key)
  where dedupe_key is not null;

alter table public.ai_jobs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ai_jobs'
      and policyname = 'ai_jobs_admin_select'
  ) then
    execute $p$
      create policy "ai_jobs_admin_select"
      on public.ai_jobs
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = ai_jobs.agency_id
            and am.user_id = auth.uid()
            and am.role = 'admin'
        )
      );
    $p$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'update_ai_jobs_updated_at'
  ) then
    execute $t$
      create trigger update_ai_jobs_updated_at
      before update on public.ai_jobs
      for each row
      execute function public.update_updated_at_column();
    $t$;
  end if;
end $$;

create or replace function public.claim_ai_jobs(p_limit integer default 5)
returns setof public.ai_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claim as (
    select id
    from public.ai_jobs
    where status = 'pending'
      and run_after <= now()
    order by run_after asc, created_at asc
    limit p_limit
    for update skip locked
  )
  update public.ai_jobs
  set status = 'running',
      attempts = attempts + 1,
      updated_at = now()
  where id in (select id from claim)
  returning *;
end;
$$;

revoke all on function public.claim_ai_jobs(integer) from public;
grant execute on function public.claim_ai_jobs(integer) to service_role;

-- Enqueue seed strategy job on onboarding completion
create or replace function public.complete_onboarding_profile(p_client_id uuid)
returns public.client_onboarding_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.client_onboarding_profiles;
  v_agency_id uuid;
begin
  update public.client_onboarding_profiles
  set completed_at = now()
  where client_id = p_client_id
    and completed_at is null
  returning * into result;

  select agency_id into v_agency_id
  from public.clients
  where id = p_client_id;

  if v_agency_id is not null then
    insert into public.ai_jobs (
      agency_id,
      client_id,
      job_type,
      payload_json,
      dedupe_key,
      status,
      run_after
    )
    values (
      v_agency_id,
      p_client_id,
      'seed_strategy',
      jsonb_build_object('source', 'onboarding'),
      'seed_strategy:' || p_client_id::text,
      'pending',
      now()
    )
    on conflict (job_type, client_id, dedupe_key)
    do update set
      status = 'pending',
      run_after = now(),
      last_error = null,
      updated_at = now();
  end if;

  return result;
end;
$$;

grant execute on function public.complete_onboarding_profile(uuid) to authenticated;
