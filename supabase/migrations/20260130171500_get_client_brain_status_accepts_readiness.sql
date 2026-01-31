-- Treat onboarding as "completed" when readiness_score reaches 100, even if completed_at is not set yet.
-- This prevents false gating in Strategy/Planning when the user filled the wizard but didn't hit the final CTA.

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
  missing text[] := ARRAY[]::text[];

  onboarding_completed boolean := false;
  onboarding_name text := '';
  onboarding_offer text := '';
  onboarding_goal text := '';
  onboarding_conversion_path text := '';
  onboarding_pain_points_len integer := 0;
  onboarding_primary_customer text := '';
  onboarding_offers_len integer := 0;

  brand_name_ok boolean := false;
  offer_ok boolean := false;
  audience_ok boolean := false;
  goals_ok boolean := false;
  pillars_ok boolean := false;
begin
  select *
  into onboarding_row
  from public.client_onboarding_profiles cop
  where cop.client_id = p_client_id
  order by cop.updated_at desc
  limit 1;

  onboarding_completed :=
    (onboarding_row.completed_at is not null)
    or (coalesce(onboarding_row.readiness_score, 0) >= 100);

  onboarding_name := coalesce(nullif(btrim(onboarding_row.q1_business_name), ''), '');
  onboarding_offer := coalesce(nullif(btrim(onboarding_row.q6_offer_name), ''), '');
  onboarding_goal := coalesce(onboarding_row.primary_goal, onboarding_row.q17_primary_goal, '');
  onboarding_conversion_path := coalesce(nullif(btrim(onboarding_row.conversion_path), ''), '');
  onboarding_pain_points_len := coalesce(array_length(onboarding_row.q9_pain_points, 1), 0);
  onboarding_primary_customer := coalesce(
    nullif(btrim(onboarding_row.primary_customer), ''),
    nullif(btrim(onboarding_row.q8_ideal_customer), ''),
    ''
  );
  onboarding_offers_len := case
    when onboarding_row.offers is null then 0
    when jsonb_typeof(onboarding_row.offers) = 'array' then jsonb_array_length(onboarding_row.offers)
    else 0
  end;

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
    if not onboarding_completed then
      return;
    end if;

    brand_name_ok := onboarding_name <> '';
    offer_ok := onboarding_offer <> '' or onboarding_offers_len > 0;
    audience_ok := onboarding_pain_points_len > 0 or onboarding_primary_customer <> '';
    goals_ok := onboarding_goal <> '' or onboarding_conversion_path <> '';
    pillars_ok := offer_ok and audience_ok and goals_ok;

    if not brand_name_ok then missing := array_append(missing, 'brand_basics.name'); end if;
    if not offer_ok then missing := array_append(missing, 'offer_details.products_services'); end if;
    if not audience_ok then missing := array_append(missing, 'audience.problems'); end if;
    if not goals_ok then missing := array_append(missing, 'goals'); end if;
    if not pillars_ok then missing := array_append(missing, 'pillars'); end if;

    client_id := p_client_id;
    missing_fields := coalesce(missing, ARRAY[]::text[]);
    missing_fields_count := coalesce(array_length(missing, 1), 0);
    usable := missing_fields_count = 0;
    status := 'onboarding';
    locked := false;
    version := 0;
    updated_at := coalesce(onboarding_row.completed_at, onboarding_row.updated_at);
    return next;
  end if;

  brand_name_ok :=
    coalesce(nullif(btrim(brain_row.brain_json #>> '{brand_basics,name}'), ''), '') <> ''
    or onboarding_name <> '';

  offer_ok :=
    (
      case
        when jsonb_typeof(brain_row.brain_json #> '{offer_details,products_services}') = 'array'
          then jsonb_array_length(brain_row.brain_json #> '{offer_details,products_services}')
        else 0
      end
    ) > 0
    or onboarding_offer <> ''
    or onboarding_offers_len > 0;

  audience_ok :=
    (
      case
        when jsonb_typeof(brain_row.brain_json #> '{audience,problems}') = 'array'
          then jsonb_array_length(brain_row.brain_json #> '{audience,problems}')
        else 0
      end
    ) > 0
    or onboarding_pain_points_len > 0
    or onboarding_primary_customer <> '';

  goals_ok :=
    (
      case
        when jsonb_typeof(brain_row.brain_json -> 'goals') = 'array'
          then jsonb_array_length(brain_row.brain_json -> 'goals')
        else 0
      end
    ) > 0
    or onboarding_goal <> ''
    or onboarding_conversion_path <> '';

  pillars_ok :=
    (
      case
        when jsonb_typeof(brain_row.brain_json -> 'pillars') = 'array'
          then jsonb_array_length(brain_row.brain_json -> 'pillars')
        else 0
      end
    ) > 0
    or (offer_ok and audience_ok and goals_ok);

  if not brand_name_ok then missing := array_append(missing, 'brand_basics.name'); end if;
  if not offer_ok then missing := array_append(missing, 'offer_details.products_services'); end if;
  if not audience_ok then missing := array_append(missing, 'audience.problems'); end if;
  if not goals_ok then missing := array_append(missing, 'goals'); end if;
  if not pillars_ok then missing := array_append(missing, 'pillars'); end if;

  client_id := brain_row.client_id;
  missing_fields := coalesce(missing, ARRAY[]::text[]);
  missing_fields_count := coalesce(array_length(missing, 1), 0);
  usable := brain_row.usable or (onboarding_completed and missing_fields_count = 0);
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

