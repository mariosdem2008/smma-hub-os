-- ============================================================================
-- SMMA Onboarding Fields (Backwards Compatible)
-- Adds new fields for SMMA-optimized onboarding and updates upsert RPC.
-- ============================================================================

ALTER TABLE public.client_onboarding_profiles
  ADD COLUMN IF NOT EXISTS industry_niche TEXT,
  ADD COLUMN IF NOT EXISTS primary_goal TEXT,
  ADD COLUMN IF NOT EXISTS conversion_path TEXT,
  ADD COLUMN IF NOT EXISTS conversion_link TEXT,
  ADD COLUMN IF NOT EXISTS offers JSONB,
  ADD COLUMN IF NOT EXISTS audience_type TEXT,
  ADD COLUMN IF NOT EXISTS primary_customer TEXT,
  ADD COLUMN IF NOT EXISTS main_objection TEXT,
  ADD COLUMN IF NOT EXISTS brand_voice TEXT[],
  ADD COLUMN IF NOT EXISTS content_style TEXT[],
  ADD COLUMN IF NOT EXISTS on_camera_availability TEXT,
  ADD COLUMN IF NOT EXISTS available_assets TEXT[],
  ADD COLUMN IF NOT EXISTS proof_types TEXT[],
  ADD COLUMN IF NOT EXISTS competitor_link TEXT,
  ADD COLUMN IF NOT EXISTS platforms TEXT[],
  ADD COLUMN IF NOT EXISTS formats TEXT[],
  ADD COLUMN IF NOT EXISTS cadence_preset TEXT,
  ADD COLUMN IF NOT EXISTS cadence_per_platform JSONB,
  ADD COLUMN IF NOT EXISTS response_handling TEXT;

-- Update upsert RPC to include new fields
CREATE OR REPLACE FUNCTION public.upsert_onboarding_profile(
  p_client_id UUID,
  p_agency_id UUID,
  p_flow_type TEXT,
  p_current_step INTEGER,
  p_profile_data JSONB
)
RETURNS public.client_onboarding_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.client_onboarding_profiles;
BEGIN
  INSERT INTO public.client_onboarding_profiles (
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
  VALUES (
    p_client_id,
    p_agency_id,
    p_flow_type,
    p_current_step,
    auth.uid(),
    -- Section A
    p_profile_data->>'q1_business_name', (p_profile_data->>'q1_provenance')::public.answer_provenance,
    p_profile_data->>'q2_website',
    CASE WHEN p_profile_data->'q2_social_links' IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(p_profile_data->'q2_social_links')) END,
    (p_profile_data->>'q2_provenance')::public.answer_provenance,
    p_profile_data->>'q3_market_scope', p_profile_data->>'q3_country', p_profile_data->>'q3_city', (p_profile_data->>'q3_provenance')::public.answer_provenance,
    CASE WHEN p_profile_data->'q4_languages' IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(p_profile_data->'q4_languages')) END,
    (p_profile_data->>'q4_provenance')::public.answer_provenance,
    p_profile_data->>'q5_offer_type', (p_profile_data->>'q5_provenance')::public.answer_provenance,
    p_profile_data->>'q6_offer_name', (p_profile_data->>'q6_price_min')::NUMERIC, (p_profile_data->>'q6_price_max')::NUMERIC, p_profile_data->>'q6_main_cta', (p_profile_data->>'q6_provenance')::public.answer_provenance,
    -- Section B
    p_profile_data->>'q7_business_model', (p_profile_data->>'q7_provenance')::public.answer_provenance,
    p_profile_data->>'q8_ideal_customer', (p_profile_data->>'q8_provenance')::public.answer_provenance,
    CASE WHEN p_profile_data->'q9_pain_points' IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(p_profile_data->'q9_pain_points')) END,
    (p_profile_data->>'q9_provenance')::public.answer_provenance,
    p_profile_data->>'q10_desired_outcome', (p_profile_data->>'q10_provenance')::public.answer_provenance,
    p_profile_data->>'q11_sales_cycle', (p_profile_data->>'q11_provenance')::public.answer_provenance,
    -- Section C
    p_profile_data->'q12_competitors', (p_profile_data->>'q12_provenance')::public.answer_provenance,
    CASE WHEN p_profile_data->'q13_differentiators' IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(p_profile_data->'q13_differentiators')) END,
    (p_profile_data->>'q13_provenance')::public.answer_provenance,
    p_profile_data->>'q14_proof_level', (p_profile_data->>'q14_provenance')::public.answer_provenance,
    p_profile_data->'q15_proof_points', (p_profile_data->>'q15_provenance')::public.answer_provenance,
    -- Section D
    CASE WHEN p_profile_data->'q16_enabled_channels' IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(p_profile_data->'q16_enabled_channels')) END,
    (p_profile_data->>'q16_provenance')::public.answer_provenance,
    p_profile_data->>'q17_primary_goal', (p_profile_data->>'q17_provenance')::public.answer_provenance,
    p_profile_data->'q18_cadence', (p_profile_data->>'q18_provenance')::public.answer_provenance,
    -- AI Scan
    p_profile_data->'ai_scan_result',
    CASE WHEN p_profile_data->>'ai_scan_at' IS NOT NULL THEN (p_profile_data->>'ai_scan_at')::TIMESTAMPTZ END,
    COALESCE((p_profile_data->>'ai_scan_accepted')::BOOLEAN, false),
    -- Readiness
    COALESCE((p_profile_data->>'readiness_score')::INTEGER, 0),
    COALESCE(p_profile_data->'blockers', '[]'::jsonb),
    -- SMMA fields
    p_profile_data->>'industry_niche',
    p_profile_data->>'primary_goal',
    p_profile_data->>'conversion_path',
    p_profile_data->>'conversion_link',
    p_profile_data->'offers',
    p_profile_data->>'audience_type',
    p_profile_data->>'primary_customer',
    p_profile_data->>'main_objection',
    CASE WHEN p_profile_data->'brand_voice' IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(p_profile_data->'brand_voice')) END,
    CASE WHEN p_profile_data->'content_style' IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(p_profile_data->'content_style')) END,
    p_profile_data->>'on_camera_availability',
    CASE WHEN p_profile_data->'available_assets' IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(p_profile_data->'available_assets')) END,
    CASE WHEN p_profile_data->'proof_types' IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(p_profile_data->'proof_types')) END,
    p_profile_data->>'competitor_link',
    CASE WHEN p_profile_data->'platforms' IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(p_profile_data->'platforms')) END,
    CASE WHEN p_profile_data->'formats' IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(p_profile_data->'formats')) END,
    p_profile_data->>'cadence_preset',
    p_profile_data->'cadence_per_platform',
    p_profile_data->>'response_handling'
  )
  ON CONFLICT (client_id) DO UPDATE SET
    flow_type = EXCLUDED.flow_type,
    current_step = EXCLUDED.current_step,
    -- Section A
    q1_business_name = COALESCE(EXCLUDED.q1_business_name, client_onboarding_profiles.q1_business_name),
    q1_provenance = COALESCE(EXCLUDED.q1_provenance, client_onboarding_profiles.q1_provenance),
    q2_website = COALESCE(EXCLUDED.q2_website, client_onboarding_profiles.q2_website),
    q2_social_links = COALESCE(EXCLUDED.q2_social_links, client_onboarding_profiles.q2_social_links),
    q2_provenance = COALESCE(EXCLUDED.q2_provenance, client_onboarding_profiles.q2_provenance),
    q3_market_scope = COALESCE(EXCLUDED.q3_market_scope, client_onboarding_profiles.q3_market_scope),
    q3_country = COALESCE(EXCLUDED.q3_country, client_onboarding_profiles.q3_country),
    q3_city = COALESCE(EXCLUDED.q3_city, client_onboarding_profiles.q3_city),
    q3_provenance = COALESCE(EXCLUDED.q3_provenance, client_onboarding_profiles.q3_provenance),
    q4_languages = COALESCE(EXCLUDED.q4_languages, client_onboarding_profiles.q4_languages),
    q4_provenance = COALESCE(EXCLUDED.q4_provenance, client_onboarding_profiles.q4_provenance),
    q5_offer_type = COALESCE(EXCLUDED.q5_offer_type, client_onboarding_profiles.q5_offer_type),
    q5_provenance = COALESCE(EXCLUDED.q5_provenance, client_onboarding_profiles.q5_provenance),
    q6_offer_name = COALESCE(EXCLUDED.q6_offer_name, client_onboarding_profiles.q6_offer_name),
    q6_price_min = COALESCE(EXCLUDED.q6_price_min, client_onboarding_profiles.q6_price_min),
    q6_price_max = COALESCE(EXCLUDED.q6_price_max, client_onboarding_profiles.q6_price_max),
    q6_main_cta = COALESCE(EXCLUDED.q6_main_cta, client_onboarding_profiles.q6_main_cta),
    q6_provenance = COALESCE(EXCLUDED.q6_provenance, client_onboarding_profiles.q6_provenance),
    -- Section B
    q7_business_model = COALESCE(EXCLUDED.q7_business_model, client_onboarding_profiles.q7_business_model),
    q7_provenance = COALESCE(EXCLUDED.q7_provenance, client_onboarding_profiles.q7_provenance),
    q8_ideal_customer = COALESCE(EXCLUDED.q8_ideal_customer, client_onboarding_profiles.q8_ideal_customer),
    q8_provenance = COALESCE(EXCLUDED.q8_provenance, client_onboarding_profiles.q8_provenance),
    q9_pain_points = COALESCE(EXCLUDED.q9_pain_points, client_onboarding_profiles.q9_pain_points),
    q9_provenance = COALESCE(EXCLUDED.q9_provenance, client_onboarding_profiles.q9_provenance),
    q10_desired_outcome = COALESCE(EXCLUDED.q10_desired_outcome, client_onboarding_profiles.q10_desired_outcome),
    q10_provenance = COALESCE(EXCLUDED.q10_provenance, client_onboarding_profiles.q10_provenance),
    q11_sales_cycle = COALESCE(EXCLUDED.q11_sales_cycle, client_onboarding_profiles.q11_sales_cycle),
    q11_provenance = COALESCE(EXCLUDED.q11_provenance, client_onboarding_profiles.q11_provenance),
    -- Section C
    q12_competitors = COALESCE(EXCLUDED.q12_competitors, client_onboarding_profiles.q12_competitors),
    q12_provenance = COALESCE(EXCLUDED.q12_provenance, client_onboarding_profiles.q12_provenance),
    q13_differentiators = COALESCE(EXCLUDED.q13_differentiators, client_onboarding_profiles.q13_differentiators),
    q13_provenance = COALESCE(EXCLUDED.q13_provenance, client_onboarding_profiles.q13_provenance),
    q14_proof_level = COALESCE(EXCLUDED.q14_proof_level, client_onboarding_profiles.q14_proof_level),
    q14_provenance = COALESCE(EXCLUDED.q14_provenance, client_onboarding_profiles.q14_provenance),
    q15_proof_points = COALESCE(EXCLUDED.q15_proof_points, client_onboarding_profiles.q15_proof_points),
    q15_provenance = COALESCE(EXCLUDED.q15_provenance, client_onboarding_profiles.q15_provenance),
    -- Section D
    q16_enabled_channels = COALESCE(EXCLUDED.q16_enabled_channels, client_onboarding_profiles.q16_enabled_channels),
    q16_provenance = COALESCE(EXCLUDED.q16_provenance, client_onboarding_profiles.q16_provenance),
    q17_primary_goal = COALESCE(EXCLUDED.q17_primary_goal, client_onboarding_profiles.q17_primary_goal),
    q17_provenance = COALESCE(EXCLUDED.q17_provenance, client_onboarding_profiles.q17_provenance),
    q18_cadence = COALESCE(EXCLUDED.q18_cadence, client_onboarding_profiles.q18_cadence),
    q18_provenance = COALESCE(EXCLUDED.q18_provenance, client_onboarding_profiles.q18_provenance),
    -- AI Scan
    ai_scan_result = COALESCE(EXCLUDED.ai_scan_result, client_onboarding_profiles.ai_scan_result),
    ai_scan_at = COALESCE(EXCLUDED.ai_scan_at, client_onboarding_profiles.ai_scan_at),
    ai_scan_accepted = COALESCE(EXCLUDED.ai_scan_accepted, client_onboarding_profiles.ai_scan_accepted),
    -- Readiness
    readiness_score = EXCLUDED.readiness_score,
    blockers = EXCLUDED.blockers,
    -- SMMA fields
    industry_niche = COALESCE(EXCLUDED.industry_niche, client_onboarding_profiles.industry_niche),
    primary_goal = COALESCE(EXCLUDED.primary_goal, client_onboarding_profiles.primary_goal),
    conversion_path = COALESCE(EXCLUDED.conversion_path, client_onboarding_profiles.conversion_path),
    conversion_link = COALESCE(EXCLUDED.conversion_link, client_onboarding_profiles.conversion_link),
    offers = COALESCE(EXCLUDED.offers, client_onboarding_profiles.offers),
    audience_type = COALESCE(EXCLUDED.audience_type, client_onboarding_profiles.audience_type),
    primary_customer = COALESCE(EXCLUDED.primary_customer, client_onboarding_profiles.primary_customer),
    main_objection = COALESCE(EXCLUDED.main_objection, client_onboarding_profiles.main_objection),
    brand_voice = COALESCE(EXCLUDED.brand_voice, client_onboarding_profiles.brand_voice),
    content_style = COALESCE(EXCLUDED.content_style, client_onboarding_profiles.content_style),
    on_camera_availability = COALESCE(EXCLUDED.on_camera_availability, client_onboarding_profiles.on_camera_availability),
    available_assets = COALESCE(EXCLUDED.available_assets, client_onboarding_profiles.available_assets),
    proof_types = COALESCE(EXCLUDED.proof_types, client_onboarding_profiles.proof_types),
    competitor_link = COALESCE(EXCLUDED.competitor_link, client_onboarding_profiles.competitor_link),
    platforms = COALESCE(EXCLUDED.platforms, client_onboarding_profiles.platforms),
    formats = COALESCE(EXCLUDED.formats, client_onboarding_profiles.formats),
    cadence_preset = COALESCE(EXCLUDED.cadence_preset, client_onboarding_profiles.cadence_preset),
    cadence_per_platform = COALESCE(EXCLUDED.cadence_per_platform, client_onboarding_profiles.cadence_per_platform),
    response_handling = COALESCE(EXCLUDED.response_handling, client_onboarding_profiles.response_handling),
    updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_onboarding_profile(UUID, UUID, TEXT, INTEGER, JSONB) TO authenticated;
