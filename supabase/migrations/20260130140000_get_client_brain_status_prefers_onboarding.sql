-- Ensure Strategy generation can be unlocked purely from completed Client Onboarding.
-- This avoids false "missing fields" during the brief window where ClientBrain is syncing/upgrading.

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
  onboarding_row record;
  onboarding_name text := '';
  onboarding_offer text := '';
  onboarding_goal text := '';
  onboarding_pain_points_len integer := 0;
  onboarding_has_channels boolean := false;
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

  -- Prefer the latest usable brain if it exists; otherwise fall back to latest version.
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
  order by (case when cb.usable then 1 else 0 end) desc, cb.version desc
  limit 1;

  if brain_row.client_id is null then
    return;
  end if;

  -- Latest completed onboarding snapshot (v4 table).
  select
    p.q1_business_name,
    p.q6_offer_name,
    p.q17_primary_goal,
    p.primary_goal,
    p.q9_pain_points,
    p.q16_enabled_channels,
    p.platforms,
    p.completed_at
  into onboarding_row
  from public.client_onboarding_profiles p
  where p.client_id = p_client_id
    and p.completed_at is not null
  order by p.updated_at desc nulls last
  limit 1;

  onboarding_name := coalesce(nullif(btrim(onboarding_row.q1_business_name), ''), '');
  onboarding_offer := coalesce(nullif(btrim(onboarding_row.q6_offer_name), ''), '');
  onboarding_goal := coalesce(onboarding_row.primary_goal, onboarding_row.q17_primary_goal, '');
  onboarding_pain_points_len := coalesce(array_length(onboarding_row.q9_pain_points, 1), 0);
  onboarding_has_channels :=
    coalesce(array_length(onboarding_row.platforms, 1), 0) > 0
    or coalesce(array_length(onboarding_row.q16_enabled_channels, 1), 0) > 0;

  -- Brand name: accept onboarding q1_business_name as sufficient.
  if (
    coalesce(nullif(btrim(brain_row.brain_json #>> '{brand_basics,name}'), ''), '') = ''
    and onboarding_name = ''
  ) then
    missing := array_append(missing, 'brand_basics.name');
  end if;

  -- Offer: accept onboarding q6_offer_name as sufficient.
  if (
    (
      case
        when jsonb_typeof(brain_row.brain_json #> '{offer_details,products_services}') = 'array'
          then jsonb_array_length(brain_row.brain_json #> '{offer_details,products_services}')
        else 0
      end
    ) = 0
    and onboarding_offer = ''
  ) then
    missing := array_append(missing, 'offer_details.products_services');
  end if;

  -- Audience problems: accept onboarding pain points as sufficient.
  if (
    (
      case
        when jsonb_typeof(brain_row.brain_json #> '{audience,problems}') = 'array'
          then jsonb_array_length(brain_row.brain_json #> '{audience,problems}')
        else 0
      end
    ) = 0
    and onboarding_pain_points_len < 1
  ) then
    missing := array_append(missing, 'audience.problems');
  end if;

  -- Goals: accept onboarding primary goal as sufficient.
  if (
    (
      case
        when jsonb_typeof(brain_row.brain_json -> 'goals') = 'array'
          then jsonb_array_length(brain_row.brain_json -> 'goals')
        else 0
      end
    ) = 0
    and onboarding_goal = ''
  ) then
    missing := array_append(missing, 'goals');
  end if;

  -- Pillars can be inferred from onboarding (offer + pains + goal). Do not hard-block strategy if onboarding is complete.
  if (
    (
      case
        when jsonb_typeof(brain_row.brain_json -> 'pillars') = 'array'
          then jsonb_array_length(brain_row.brain_json -> 'pillars')
        else 0
      end
    ) = 0
    and not (onboarding_offer <> '' and onboarding_pain_points_len >= 1 and onboarding_goal <> '')
  ) then
    missing := array_append(missing, 'pillars');
  end if;

  -- Constraints: if the brain has neither banned_claims nor taboo_topics, consider it missing.
  -- (Onboarding doesn't currently ask this explicitly, but our client brain mapping typically seeds safe defaults.)
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
  missing_fields := coalesce(missing, ARRAY[]::text[]);
  missing_fields_count := coalesce(array_length(missing, 1), 0);

  -- If onboarding is completed and nothing is missing, consider the client usable even if the latest brain row
  -- is mid-sync (prevents confusing UI blocks).
  usable := brain_row.usable or (onboarding_row.completed_at is not null and missing_fields_count = 0 and onboarding_has_channels);

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

