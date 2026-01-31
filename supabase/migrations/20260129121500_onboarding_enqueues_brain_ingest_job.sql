-- Phase 1: Onboarding completion enqueues brain ingest (server-side orchestrator)
-- Replaces complete_onboarding_profile to enqueue ingest_client_brain.

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
      'ingest_client_brain',
      jsonb_build_object('source', 'onboarding'),
      'ingest_client_brain:' || p_client_id::text,
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
