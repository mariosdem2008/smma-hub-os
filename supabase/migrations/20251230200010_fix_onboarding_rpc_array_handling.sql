-- ============================================================================
-- Fix array handling in upsert_onboarding_profile RPC
-- Fixes: "cannot extract elements from a scalar" error
-- ============================================================================

-- Drop and recreate the function with proper array type checking
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
    readiness_score, blockers
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
    -- Fix: Check both NOT NULL and that it's actually an array
    CASE
      WHEN p_profile_data->'q2_social_links' IS NOT NULL
        AND jsonb_typeof(p_profile_data->'q2_social_links') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_profile_data->'q2_social_links'))
    END,
    (p_profile_data->>'q2_provenance')::public.answer_provenance,
    p_profile_data->>'q3_market_scope', p_profile_data->>'q3_country', p_profile_data->>'q3_city', (p_profile_data->>'q3_provenance')::public.answer_provenance,
    CASE
      WHEN p_profile_data->'q4_languages' IS NOT NULL
        AND jsonb_typeof(p_profile_data->'q4_languages') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_profile_data->'q4_languages'))
    END,
    (p_profile_data->>'q4_provenance')::public.answer_provenance,
    p_profile_data->>'q5_offer_type', (p_profile_data->>'q5_provenance')::public.answer_provenance,
    p_profile_data->>'q6_offer_name', (p_profile_data->>'q6_price_min')::NUMERIC, (p_profile_data->>'q6_price_max')::NUMERIC, p_profile_data->>'q6_main_cta', (p_profile_data->>'q6_provenance')::public.answer_provenance,
    -- Section B
    p_profile_data->>'q7_business_model', (p_profile_data->>'q7_provenance')::public.answer_provenance,
    p_profile_data->>'q8_ideal_customer', (p_profile_data->>'q8_provenance')::public.answer_provenance,
    CASE
      WHEN p_profile_data->'q9_pain_points' IS NOT NULL
        AND jsonb_typeof(p_profile_data->'q9_pain_points') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_profile_data->'q9_pain_points'))
    END,
    (p_profile_data->>'q9_provenance')::public.answer_provenance,
    p_profile_data->>'q10_desired_outcome', (p_profile_data->>'q10_provenance')::public.answer_provenance,
    p_profile_data->>'q11_sales_cycle', (p_profile_data->>'q11_provenance')::public.answer_provenance,
    -- Section C
    CASE
      WHEN p_profile_data->'q12_competitors' IS NOT NULL
        AND jsonb_typeof(p_profile_data->'q12_competitors') = 'array'
      THEN p_profile_data->'q12_competitors'
    END,
    (p_profile_data->>'q12_provenance')::public.answer_provenance,
    CASE
      WHEN p_profile_data->'q13_differentiators' IS NOT NULL
        AND jsonb_typeof(p_profile_data->'q13_differentiators') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_profile_data->'q13_differentiators'))
    END,
    (p_profile_data->>'q13_provenance')::public.answer_provenance,
    p_profile_data->>'q14_proof_level', (p_profile_data->>'q14_provenance')::public.answer_provenance,
    CASE
      WHEN p_profile_data->'q15_proof_points' IS NOT NULL
        AND jsonb_typeof(p_profile_data->'q15_proof_points') = 'array'
      THEN p_profile_data->'q15_proof_points'
    END,
    (p_profile_data->>'q15_provenance')::public.answer_provenance,
    -- Section D
    CASE
      WHEN p_profile_data->'q16_enabled_channels' IS NOT NULL
        AND jsonb_typeof(p_profile_data->'q16_enabled_channels') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_profile_data->'q16_enabled_channels'))
    END,
    (p_profile_data->>'q16_provenance')::public.answer_provenance,
    p_profile_data->>'q17_primary_goal', (p_profile_data->>'q17_provenance')::public.answer_provenance,
    CASE
      WHEN p_profile_data->'q18_cadence' IS NOT NULL
        AND jsonb_typeof(p_profile_data->'q18_cadence') = 'object'
      THEN p_profile_data->'q18_cadence'
    END,
    (p_profile_data->>'q18_provenance')::public.answer_provenance,
    -- AI Scan
    CASE
      WHEN p_profile_data->'ai_scan_result' IS NOT NULL
        AND jsonb_typeof(p_profile_data->'ai_scan_result') = 'object'
      THEN p_profile_data->'ai_scan_result'
    END,
    CASE WHEN p_profile_data->>'ai_scan_at' IS NOT NULL THEN (p_profile_data->>'ai_scan_at')::TIMESTAMPTZ END,
    COALESCE((p_profile_data->>'ai_scan_accepted')::BOOLEAN, false),
    -- Readiness
    COALESCE((p_profile_data->>'readiness_score')::INTEGER, 0),
    CASE
      WHEN p_profile_data->'blockers' IS NOT NULL
        AND jsonb_typeof(p_profile_data->'blockers') = 'array'
      THEN p_profile_data->'blockers'
      ELSE '[]'::jsonb
    END
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
    updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

-- Re-grant execute permission
GRANT EXECUTE ON FUNCTION public.upsert_onboarding_profile(UUID, UUID, TEXT, INTEGER, JSONB) TO authenticated;
