-- Fix: avoid false "business name missing" when ClientBrain is still syncing
-- from onboarding. If onboarding has q1_business_name, treat brand_basics.name
-- as present for the purposes of gating UX.

create or replace function public.get_client_brain_status(p_client_id uuid)
returns table (
  client_id uuid,
  usable boolean,
  missing_fields_count integer,
  missing_fields text[],
  status text,
  locked boolean,
  version integer,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  brain_row record;
  onboarding_name text := '';
  missing text[] := ARRAY[]::text[];
  banned_claims_len integer := 0;
  taboo_topics_len integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.clients c
    join public.agency_members am on am.agency_id = c.agency_id
    where c.id = p_client_id
      and am.user_id = auth.uid()
  ) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  -- Latest brain row
  select
    cb.client_id,
    cb.usable,
    cb.status,
    cb.locked,
    cb.version,
    cb.updated_at,
    cb.brain_json
  into brain_row
  from public.client_brains cb
  where cb.client_id = p_client_id
  order by cb.version desc
  limit 1;

  if brain_row.client_id is null then
    return;
  end if;

  -- Fallback: completed onboarding may have the business name even if the newest brain row
  -- is still in a baseline/transition state.
  select coalesce(nullif(btrim(p.q1_business_name), ''), '')
  into onboarding_name
  from public.client_onboarding_profiles p
  where p.client_id = p_client_id
    and p.completed_at is not null
  order by p.updated_at desc nulls last
  limit 1;

  if (
    coalesce(nullif(btrim(brain_row.brain_json #>> '{brand_basics,name}'), ''), '') = ''
    and coalesce(onboarding_name, '') = ''
  ) then
    missing := array_append(missing, 'brand_basics.name');
  end if;

  if (
    case
      when jsonb_typeof(brain_row.brain_json #> '{offer_details,products_services}') = 'array'
        then jsonb_array_length(brain_row.brain_json #> '{offer_details,products_services}')
      else 0
    end
  ) = 0 then
    missing := array_append(missing, 'offer_details.products_services');
  end if;

  if (
    case
      when jsonb_typeof(brain_row.brain_json #> '{audience,problems}') = 'array'
        then jsonb_array_length(brain_row.brain_json #> '{audience,problems}')
      else 0
    end
  ) = 0 then
    missing := array_append(missing, 'audience.problems');
  end if;

  if (
    case
      when jsonb_typeof(brain_row.brain_json -> 'pillars') = 'array'
        then jsonb_array_length(brain_row.brain_json -> 'pillars')
      else 0
    end
  ) = 0 then
    missing := array_append(missing, 'pillars');
  end if;

  if (
    case
      when jsonb_typeof(brain_row.brain_json -> 'goals') = 'array'
        then jsonb_array_length(brain_row.brain_json -> 'goals')
      else 0
    end
  ) = 0 then
    missing := array_append(missing, 'goals');
  end if;

  banned_claims_len := case
    when jsonb_typeof(brain_row.brain_json #> '{constraints,banned_claims}') = 'array'
      then jsonb_array_length(brain_row.brain_json #> '{constraints,banned_claims}')
    else 0
  end;
  taboo_topics_len := case
    when jsonb_typeof(brain_row.brain_json #> '{constraints,taboo_topics}') = 'array'
      then jsonb_array_length(brain_row.brain_json #> '{constraints,taboo_topics}')
    else 0
  end;

  if banned_claims_len = 0 and taboo_topics_len = 0 then
    missing := array_append(missing, 'constraints.banned_claims_or_taboo_topics');
  end if;

  client_id := brain_row.client_id;
  usable := brain_row.usable;
  missing_fields := coalesce(missing, ARRAY[]::text[]);
  missing_fields_count := coalesce(array_length(missing, 1), 0);
  status := brain_row.status;
  locked := brain_row.locked;
  version := brain_row.version;
  updated_at := brain_row.updated_at;

  return next;
end;
$$;

alter function public.get_client_brain_status(uuid) owner to postgres;

revoke all on function public.get_client_brain_status(uuid) from public;
revoke execute on function public.get_client_brain_status(uuid) from anon;
grant execute on function public.get_client_brain_status(uuid) to authenticated;
grant execute on function public.get_client_brain_status(uuid) to service_role;

