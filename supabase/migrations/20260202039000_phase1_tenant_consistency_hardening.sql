-- Phase 1 hardening: enforce client -> agency consistency on onboarding persistence tables.
-- This complements RLS by preventing mismatched tenant writes even under elevated roles.

create or replace function public.assert_client_belongs_to_agency()
returns trigger
language plpgsql
as $$
declare
  v_client_agency uuid;
begin
  if new.client_id is null then
    return new;
  end if;

  select c.agency_id
    into v_client_agency
  from public.clients c
  where c.id = new.client_id;

  if v_client_agency is null then
    raise exception 'client_id % was not found', new.client_id
      using errcode = '23503';
  end if;

  if v_client_agency <> new.agency_id then
    raise exception 'client_id % does not belong to agency_id %', new.client_id, new.agency_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.assert_onboarding_log_status_scope_match()
returns trigger
language plpgsql
as $$
declare
  v_status_agency uuid;
  v_status_client uuid;
begin
  if new.onboarding_status_id is null then
    return new;
  end if;

  select s.agency_id, s.client_id
    into v_status_agency, v_status_client
  from public.ai_onboarding_status s
  where s.id = new.onboarding_status_id;

  if v_status_agency is null then
    raise exception 'onboarding_status_id % was not found', new.onboarding_status_id
      using errcode = '23503';
  end if;

  if v_status_agency <> new.agency_id then
    raise exception 'onboarding_status_id % agency mismatch with onboarding_turn_log', new.onboarding_status_id
      using errcode = '23514';
  end if;

  if coalesce(v_status_client, '00000000-0000-0000-0000-000000000000'::uuid)
     <> coalesce(new.client_id, '00000000-0000-0000-0000-000000000000'::uuid) then
    raise exception 'onboarding_status_id % client scope mismatch with onboarding_turn_log', new.onboarding_status_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ai_onboarding_status_client_agency_guard on public.ai_onboarding_status;
create trigger trg_ai_onboarding_status_client_agency_guard
  before insert or update of agency_id, client_id
  on public.ai_onboarding_status
  for each row
  execute function public.assert_client_belongs_to_agency();

drop trigger if exists trg_ai_persona_vectors_client_agency_guard on public.ai_persona_vectors;
create trigger trg_ai_persona_vectors_client_agency_guard
  before insert or update of agency_id, client_id
  on public.ai_persona_vectors
  for each row
  execute function public.assert_client_belongs_to_agency();

drop trigger if exists trg_ai_onboarding_turn_logs_client_agency_guard on public.ai_onboarding_turn_logs;
create trigger trg_ai_onboarding_turn_logs_client_agency_guard
  before insert or update of agency_id, client_id
  on public.ai_onboarding_turn_logs
  for each row
  execute function public.assert_client_belongs_to_agency();

drop trigger if exists trg_ai_onboarding_turn_logs_status_scope_guard on public.ai_onboarding_turn_logs;
create trigger trg_ai_onboarding_turn_logs_status_scope_guard
  before insert or update of onboarding_status_id, agency_id, client_id
  on public.ai_onboarding_turn_logs
  for each row
  execute function public.assert_onboarding_log_status_scope_match();

