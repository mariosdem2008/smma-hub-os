-- Add DM keyword to onboarding so strategies can use the exact keyword.

alter table public.client_onboarding_profiles
  add column if not exists dm_keyword text;

create or replace function public.upsert_onboarding_profile(
  p_client_id uuid,
  p_agency_id uuid,
  p_flow_type text,
  p_current_step integer,
  p_profile_data jsonb
)
returns public.client_onboarding_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.client_onboarding_profiles;
begin
  insert into public.client_onboarding_profiles (
    client_id,
    agency_id,
    flow_type,
    current_step,
    created_by,
    -- Section A
    q1_business_name, q1_provenance,
    q2_website, q2_social_links, q2_provenance,
    q3_market_scope, q3_country, q3_city, q3_provenance,
    q4_languages, q4_provenance,
    q5_offer_type, q5_provenance,
    q6_offer_name, q6_price_min, q6_price_max, q6_main_cta, q6_provenance,
    -- Section B
    q7_business_model, q7_provenance,
    q8_ideal_customer, q8_provenance,
    q9_pain_points, q9_provenance,
    q10_desired_outcome, q10_provenance,
    q11_sales_cycle, q11_provenance,
    -- Section C
    q12_competitors, q12_provenance,
    q13_differentiators, q13_provenance,
    q14_proof_level, q14_provenance,
    q15_proof_points, q15_provenance,
    -- Section D
    q16_enabled_channels, q16_provenance,
    q17_primary_goal, q17_provenance,
    q18_cadence, q18_provenance,
    -- AI Scan
    ai_scan_result, ai_scan_at, ai_scan_accepted,
    -- Readiness
    readiness_score, blockers,
    -- SMMA fields
    industry_niche,
    primary_goal,
    conversion_path,
    conversion_link,
    dm_keyword,
    offers,
    audience_type,
    primary_customer,
    main_objection,
    brand_voice,
    content_style,
    on_camera_availability,
    available_assets,
    proof_types,
    competitor_link,
    platforms,
    formats,
    cadence_preset,
    cadence_per_platform,
    response_handling
  )
  values (
    p_client_id,
    p_agency_id,
    p_flow_type,
    p_current_step,
    auth.uid(),
    -- Section A
    p_profile_data->>'q1_business_name', (p_profile_data->>'q1_provenance')::public.answer_provenance,
    p_profile_data->>'q2_website',
    case when p_profile_data->'q2_social_links' is not null then array(select jsonb_array_elements_text(p_profile_data->'q2_social_links')) end,
    (p_profile_data->>'q2_provenance')::public.answer_provenance,
    p_profile_data->>'q3_market_scope', p_profile_data->>'q3_country', p_profile_data->>'q3_city', (p_profile_data->>'q3_provenance')::public.answer_provenance,
    case when p_profile_data->'q4_languages' is not null then array(select jsonb_array_elements_text(p_profile_data->'q4_languages')) end,
    (p_profile_data->>'q4_provenance')::public.answer_provenance,
    p_profile_data->>'q5_offer_type', (p_profile_data->>'q5_provenance')::public.answer_provenance,
    p_profile_data->>'q6_offer_name', (p_profile_data->>'q6_price_min')::numeric, (p_profile_data->>'q6_price_max')::numeric, p_profile_data->>'q6_main_cta', (p_profile_data->>'q6_provenance')::public.answer_provenance,
    -- Section B
    p_profile_data->>'q7_business_model', (p_profile_data->>'q7_provenance')::public.answer_provenance,
    p_profile_data->>'q8_ideal_customer', (p_profile_data->>'q8_provenance')::public.answer_provenance,
    case when p_profile_data->'q9_pain_points' is not null then array(select jsonb_array_elements_text(p_profile_data->'q9_pain_points')) end,
    (p_profile_data->>'q9_provenance')::public.answer_provenance,
    p_profile_data->>'q10_desired_outcome', (p_profile_data->>'q10_provenance')::public.answer_provenance,
    p_profile_data->>'q11_sales_cycle', (p_profile_data->>'q11_provenance')::public.answer_provenance,
    -- Section C
    p_profile_data->'q12_competitors', (p_profile_data->>'q12_provenance')::public.answer_provenance,
    case when p_profile_data->'q13_differentiators' is not null then array(select jsonb_array_elements_text(p_profile_data->'q13_differentiators')) end,
    (p_profile_data->>'q13_provenance')::public.answer_provenance,
    p_profile_data->>'q14_proof_level', (p_profile_data->>'q14_provenance')::public.answer_provenance,
    p_profile_data->'q15_proof_points', (p_profile_data->>'q15_provenance')::public.answer_provenance,
    -- Section D
    case when p_profile_data->'q16_enabled_channels' is not null then array(select jsonb_array_elements_text(p_profile_data->'q16_enabled_channels')) end,
    (p_profile_data->>'q16_provenance')::public.answer_provenance,
    p_profile_data->>'q17_primary_goal', (p_profile_data->>'q17_provenance')::public.answer_provenance,
    p_profile_data->'q18_cadence', (p_profile_data->>'q18_provenance')::public.answer_provenance,
    -- AI Scan
    p_profile_data->'ai_scan_result', (p_profile_data->>'ai_scan_at')::timestamptz, coalesce((p_profile_data->>'ai_scan_accepted')::boolean, false),
    -- Readiness
    coalesce((p_profile_data->>'readiness_score')::integer, 0),
    coalesce(p_profile_data->'blockers', '[]'::jsonb),
    -- SMMA fields
    p_profile_data->>'industry_niche',
    p_profile_data->>'primary_goal',
    p_profile_data->>'conversion_path',
    p_profile_data->>'conversion_link',
    p_profile_data->>'dm_keyword',
    p_profile_data->'offers',
    p_profile_data->>'audience_type',
    p_profile_data->>'primary_customer',
    p_profile_data->>'main_objection',
    case when p_profile_data->'brand_voice' is not null then array(select jsonb_array_elements_text(p_profile_data->'brand_voice')) end,
    case when p_profile_data->'content_style' is not null then array(select jsonb_array_elements_text(p_profile_data->'content_style')) end,
    p_profile_data->>'on_camera_availability',
    case when p_profile_data->'available_assets' is not null then array(select jsonb_array_elements_text(p_profile_data->'available_assets')) end,
    case when p_profile_data->'proof_types' is not null then array(select jsonb_array_elements_text(p_profile_data->'proof_types')) end,
    p_profile_data->>'competitor_link',
    case when p_profile_data->'platforms' is not null then array(select jsonb_array_elements_text(p_profile_data->'platforms')) end,
    case when p_profile_data->'formats' is not null then array(select jsonb_array_elements_text(p_profile_data->'formats')) end,
    p_profile_data->>'cadence_preset',
    p_profile_data->'cadence_per_platform',
    p_profile_data->>'response_handling'
  )
  on conflict (client_id)
  do update set
    flow_type = excluded.flow_type,
    current_step = excluded.current_step,
    -- Section A
    q1_business_name = coalesce(excluded.q1_business_name, client_onboarding_profiles.q1_business_name),
    q1_provenance = coalesce(excluded.q1_provenance, client_onboarding_profiles.q1_provenance),
    q2_website = coalesce(excluded.q2_website, client_onboarding_profiles.q2_website),
    q2_social_links = coalesce(excluded.q2_social_links, client_onboarding_profiles.q2_social_links),
    q2_provenance = coalesce(excluded.q2_provenance, client_onboarding_profiles.q2_provenance),
    q3_market_scope = coalesce(excluded.q3_market_scope, client_onboarding_profiles.q3_market_scope),
    q3_country = coalesce(excluded.q3_country, client_onboarding_profiles.q3_country),
    q3_city = coalesce(excluded.q3_city, client_onboarding_profiles.q3_city),
    q3_provenance = coalesce(excluded.q3_provenance, client_onboarding_profiles.q3_provenance),
    q4_languages = coalesce(excluded.q4_languages, client_onboarding_profiles.q4_languages),
    q4_provenance = coalesce(excluded.q4_provenance, client_onboarding_profiles.q4_provenance),
    q5_offer_type = coalesce(excluded.q5_offer_type, client_onboarding_profiles.q5_offer_type),
    q5_provenance = coalesce(excluded.q5_provenance, client_onboarding_profiles.q5_provenance),
    q6_offer_name = coalesce(excluded.q6_offer_name, client_onboarding_profiles.q6_offer_name),
    q6_price_min = coalesce(excluded.q6_price_min, client_onboarding_profiles.q6_price_min),
    q6_price_max = coalesce(excluded.q6_price_max, client_onboarding_profiles.q6_price_max),
    q6_main_cta = coalesce(excluded.q6_main_cta, client_onboarding_profiles.q6_main_cta),
    q6_provenance = coalesce(excluded.q6_provenance, client_onboarding_profiles.q6_provenance),
    -- Section B
    q7_business_model = coalesce(excluded.q7_business_model, client_onboarding_profiles.q7_business_model),
    q7_provenance = coalesce(excluded.q7_provenance, client_onboarding_profiles.q7_provenance),
    q8_ideal_customer = coalesce(excluded.q8_ideal_customer, client_onboarding_profiles.q8_ideal_customer),
    q8_provenance = coalesce(excluded.q8_provenance, client_onboarding_profiles.q8_provenance),
    q9_pain_points = coalesce(excluded.q9_pain_points, client_onboarding_profiles.q9_pain_points),
    q9_provenance = coalesce(excluded.q9_provenance, client_onboarding_profiles.q9_provenance),
    q10_desired_outcome = coalesce(excluded.q10_desired_outcome, client_onboarding_profiles.q10_desired_outcome),
    q10_provenance = coalesce(excluded.q10_provenance, client_onboarding_profiles.q10_provenance),
    q11_sales_cycle = coalesce(excluded.q11_sales_cycle, client_onboarding_profiles.q11_sales_cycle),
    q11_provenance = coalesce(excluded.q11_provenance, client_onboarding_profiles.q11_provenance),
    -- Section C
    q12_competitors = coalesce(excluded.q12_competitors, client_onboarding_profiles.q12_competitors),
    q12_provenance = coalesce(excluded.q12_provenance, client_onboarding_profiles.q12_provenance),
    q13_differentiators = coalesce(excluded.q13_differentiators, client_onboarding_profiles.q13_differentiators),
    q13_provenance = coalesce(excluded.q13_provenance, client_onboarding_profiles.q13_provenance),
    q14_proof_level = coalesce(excluded.q14_proof_level, client_onboarding_profiles.q14_proof_level),
    q14_provenance = coalesce(excluded.q14_provenance, client_onboarding_profiles.q14_provenance),
    q15_proof_points = coalesce(excluded.q15_proof_points, client_onboarding_profiles.q15_proof_points),
    q15_provenance = coalesce(excluded.q15_provenance, client_onboarding_profiles.q15_provenance),
    -- Section D
    q16_enabled_channels = coalesce(excluded.q16_enabled_channels, client_onboarding_profiles.q16_enabled_channels),
    q16_provenance = coalesce(excluded.q16_provenance, client_onboarding_profiles.q16_provenance),
    q17_primary_goal = coalesce(excluded.q17_primary_goal, client_onboarding_profiles.q17_primary_goal),
    q17_provenance = coalesce(excluded.q17_provenance, client_onboarding_profiles.q17_provenance),
    q18_cadence = coalesce(excluded.q18_cadence, client_onboarding_profiles.q18_cadence),
    q18_provenance = coalesce(excluded.q18_provenance, client_onboarding_profiles.q18_provenance),
    -- AI Scan
    ai_scan_result = coalesce(excluded.ai_scan_result, client_onboarding_profiles.ai_scan_result),
    ai_scan_at = coalesce(excluded.ai_scan_at, client_onboarding_profiles.ai_scan_at),
    ai_scan_accepted = coalesce(excluded.ai_scan_accepted, client_onboarding_profiles.ai_scan_accepted),
    -- Readiness
    readiness_score = excluded.readiness_score,
    blockers = excluded.blockers,
    -- SMMA fields
    industry_niche = coalesce(excluded.industry_niche, client_onboarding_profiles.industry_niche),
    primary_goal = coalesce(excluded.primary_goal, client_onboarding_profiles.primary_goal),
    conversion_path = coalesce(excluded.conversion_path, client_onboarding_profiles.conversion_path),
    conversion_link = coalesce(excluded.conversion_link, client_onboarding_profiles.conversion_link),
    dm_keyword = coalesce(excluded.dm_keyword, client_onboarding_profiles.dm_keyword),
    offers = coalesce(excluded.offers, client_onboarding_profiles.offers),
    audience_type = coalesce(excluded.audience_type, client_onboarding_profiles.audience_type),
    primary_customer = coalesce(excluded.primary_customer, client_onboarding_profiles.primary_customer),
    main_objection = coalesce(excluded.main_objection, client_onboarding_profiles.main_objection),
    brand_voice = coalesce(excluded.brand_voice, client_onboarding_profiles.brand_voice),
    content_style = coalesce(excluded.content_style, client_onboarding_profiles.content_style),
    on_camera_availability = coalesce(excluded.on_camera_availability, client_onboarding_profiles.on_camera_availability),
    available_assets = coalesce(excluded.available_assets, client_onboarding_profiles.available_assets),
    proof_types = coalesce(excluded.proof_types, client_onboarding_profiles.proof_types),
    competitor_link = coalesce(excluded.competitor_link, client_onboarding_profiles.competitor_link),
    platforms = coalesce(excluded.platforms, client_onboarding_profiles.platforms),
    formats = coalesce(excluded.formats, client_onboarding_profiles.formats),
    cadence_preset = coalesce(excluded.cadence_preset, client_onboarding_profiles.cadence_preset),
    cadence_per_platform = coalesce(excluded.cadence_per_platform, client_onboarding_profiles.cadence_per_platform),
    response_handling = coalesce(excluded.response_handling, client_onboarding_profiles.response_handling),
    updated_at = now()
  returning * into result;

  return result;
end;
$$;

grant execute on function public.upsert_onboarding_profile(uuid, uuid, text, integer, jsonb) to authenticated;

