-- ============================================================================
-- Client Onboarding V4 Migration
-- Replaces the old V3 onboarding system with a new 18-question micro-step wizard
-- ============================================================================

-- Step 1: Create provenance enum for tracking answer sources
CREATE TYPE public.answer_provenance AS ENUM (
  'user_selected',   -- User clicked AI chip
  'user_typed',      -- User entered custom text
  'ai_assumed',      -- User clicked "Not sure"
  'ai_scanned',      -- Auto-filled from website scan
  'ai_prefilled'     -- User clicked "Accept All" on scan
);

-- Step 2: Create the new client_onboarding_profiles table
CREATE TABLE public.client_onboarding_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,

  -- Flow tracking
  flow_type TEXT NOT NULL CHECK (flow_type IN ('agency_led', 'client_self_serve', 'agency_completion')),
  current_step INTEGER NOT NULL DEFAULT 1,
  completed_at TIMESTAMPTZ,

  -- ========================================================================
  -- Section A: Business + Offer (Q1-Q6)
  -- ========================================================================

  -- Q1: Business name
  q1_business_name TEXT,
  q1_provenance public.answer_provenance,

  -- Q2: Website + social links
  q2_website TEXT,
  q2_social_links TEXT[],
  q2_provenance public.answer_provenance,

  -- Q3: Market scope
  q3_market_scope TEXT CHECK (q3_market_scope IS NULL OR q3_market_scope IN ('local', 'national', 'international')),
  q3_country TEXT,
  q3_city TEXT,
  q3_provenance public.answer_provenance,

  -- Q4: Languages
  q4_languages TEXT[],
  q4_provenance public.answer_provenance,

  -- Q5: Primary offer type
  q5_offer_type TEXT CHECK (q5_offer_type IS NULL OR q5_offer_type IN ('service', 'product', 'subscription', 'app', 'other')),
  q5_provenance public.answer_provenance,

  -- Q6: Primary offer details
  q6_offer_name TEXT,
  q6_price_min NUMERIC,
  q6_price_max NUMERIC,
  q6_main_cta TEXT,
  q6_provenance public.answer_provenance,

  -- ========================================================================
  -- Section B: Ideal Customer + Outcome (Q7-Q11)
  -- ========================================================================

  -- Q7: Business model
  q7_business_model TEXT CHECK (q7_business_model IS NULL OR q7_business_model IN ('b2b', 'b2c', 'both')),
  q7_provenance public.answer_provenance,

  -- Q8: Ideal customer
  q8_ideal_customer TEXT,
  q8_provenance public.answer_provenance,

  -- Q9: Top 3 pain points
  q9_pain_points TEXT[],
  q9_provenance public.answer_provenance,

  -- Q10: Desired outcome
  q10_desired_outcome TEXT,
  q10_provenance public.answer_provenance,

  -- Q11: Sales cycle
  q11_sales_cycle TEXT CHECK (q11_sales_cycle IS NULL OR q11_sales_cycle IN ('same_day', '1_7_days', '1_4_weeks', '1_3_months', '3_plus_months')),
  q11_provenance public.answer_provenance,

  -- ========================================================================
  -- Section C: Differentiation + Proof (Q12-Q15)
  -- ========================================================================

  -- Q12: Top 3 competitors (array of {name, handle, url})
  q12_competitors JSONB,
  q12_provenance public.answer_provenance,

  -- Q13: Differentiators (2-4 items)
  q13_differentiators TEXT[],
  q13_provenance public.answer_provenance,

  -- Q14: Proof level
  q14_proof_level TEXT CHECK (q14_proof_level IS NULL OR q14_proof_level IN ('none', 'some', 'strong')),
  q14_provenance public.answer_provenance,

  -- Q15: Proof points (array of {claim, evidence, confidence})
  q15_proof_points JSONB,
  q15_provenance public.answer_provenance,

  -- ========================================================================
  -- Section D: Channels + Cadence (Q16-Q18)
  -- ========================================================================

  -- Q16: Enabled channels
  q16_enabled_channels TEXT[],
  q16_provenance public.answer_provenance,

  -- Q17: Primary channel goal
  q17_primary_goal TEXT CHECK (q17_primary_goal IS NULL OR q17_primary_goal IN ('discovery', 'trust', 'leads', 'community', 'sales')),
  q17_provenance public.answer_provenance,

  -- Q18: Posting cadence per platform ({platform: postsPerWeek})
  q18_cadence JSONB,
  q18_provenance public.answer_provenance,

  -- ========================================================================
  -- AI Scan Data
  -- ========================================================================
  ai_scan_result JSONB,
  ai_scan_at TIMESTAMPTZ,
  ai_scan_accepted BOOLEAN DEFAULT false,

  -- ========================================================================
  -- Readiness Tracking
  -- ========================================================================
  readiness_score INTEGER DEFAULT 0 CHECK (readiness_score >= 0 AND readiness_score <= 100),
  blockers JSONB DEFAULT '[]'::jsonb,

  -- ========================================================================
  -- Metadata
  -- ========================================================================
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique constraint: one profile per client
  CONSTRAINT unique_profile_per_client UNIQUE (client_id)
);

-- Step 3: Create indexes for common queries
CREATE INDEX idx_onboarding_profiles_agency ON public.client_onboarding_profiles(agency_id);
CREATE INDEX idx_onboarding_profiles_client ON public.client_onboarding_profiles(client_id);
CREATE INDEX idx_onboarding_profiles_flow ON public.client_onboarding_profiles(flow_type, current_step);
CREATE INDEX idx_onboarding_profiles_completed ON public.client_onboarding_profiles(completed_at) WHERE completed_at IS NOT NULL;

-- Step 4: Enable RLS
ALTER TABLE public.client_onboarding_profiles ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies

-- SELECT: Agency members can read their agency's profiles
CREATE POLICY "profiles_select" ON public.client_onboarding_profiles
  FOR SELECT TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
    )
  );

-- INSERT: Agency members can create profiles for their clients
CREATE POLICY "profiles_insert" ON public.client_onboarding_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
    )
  );

-- UPDATE: Agency members can update their profiles
CREATE POLICY "profiles_update" ON public.client_onboarding_profiles
  FOR UPDATE TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
    )
  );

-- DELETE: Agency members can delete their profiles
CREATE POLICY "profiles_delete" ON public.client_onboarding_profiles
  FOR DELETE TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
    )
  );

-- Note: Client portal uses separate authentication (not Supabase auth.uid())
-- Client portal access is handled via the client portal's own session management
-- and SECURITY DEFINER functions when needed

-- Step 6: Create auto-update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_onboarding_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_onboarding_profile_timestamp
  BEFORE UPDATE ON public.client_onboarding_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_onboarding_profile_timestamp();

-- Step 7: Create RPC to get onboarding profile status
CREATE OR REPLACE FUNCTION public.get_onboarding_profile_status(p_client_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_row public.client_onboarding_profiles%ROWTYPE;
  assumption_count INTEGER;
BEGIN
  -- Get the profile
  SELECT * INTO profile_row
  FROM public.client_onboarding_profiles
  WHERE client_id = p_client_id;

  -- If no profile exists
  IF profile_row IS NULL THEN
    RETURN jsonb_build_object(
      'exists', false,
      'completed', false,
      'readiness_score', 0,
      'blockers', '[]'::jsonb,
      'current_step', 1,
      'flow_type', NULL
    );
  END IF;

  -- Count AI assumptions
  SELECT COUNT(*) INTO assumption_count
  FROM (
    SELECT unnest(ARRAY[
      profile_row.q1_provenance,
      profile_row.q2_provenance,
      profile_row.q3_provenance,
      profile_row.q4_provenance,
      profile_row.q5_provenance,
      profile_row.q6_provenance,
      profile_row.q7_provenance,
      profile_row.q8_provenance,
      profile_row.q9_provenance,
      profile_row.q10_provenance,
      profile_row.q11_provenance,
      profile_row.q12_provenance,
      profile_row.q13_provenance,
      profile_row.q14_provenance,
      profile_row.q15_provenance,
      profile_row.q16_provenance,
      profile_row.q17_provenance,
      profile_row.q18_provenance
    ]) AS prov
  ) AS provenances
  WHERE prov = 'ai_assumed';

  RETURN jsonb_build_object(
    'exists', true,
    'completed', profile_row.completed_at IS NOT NULL,
    'flow_type', profile_row.flow_type,
    'current_step', profile_row.current_step,
    'readiness_score', profile_row.readiness_score,
    'blockers', COALESCE(profile_row.blockers, '[]'::jsonb),
    'completed_at', profile_row.completed_at,
    'assumption_count', assumption_count,
    'ai_scan_accepted', profile_row.ai_scan_accepted
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_onboarding_profile_status(UUID) TO authenticated;

-- Step 8: Create RPC to upsert onboarding profile
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
    COALESCE(p_profile_data->'blockers', '[]'::jsonb)
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.upsert_onboarding_profile(UUID, UUID, TEXT, INTEGER, JSONB) TO authenticated;

-- Step 9: Create RPC to mark onboarding complete
CREATE OR REPLACE FUNCTION public.complete_onboarding_profile(p_client_id UUID)
RETURNS public.client_onboarding_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.client_onboarding_profiles;
BEGIN
  UPDATE public.client_onboarding_profiles
  SET completed_at = now()
  WHERE client_id = p_client_id
    AND completed_at IS NULL
  RETURNING * INTO result;

  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.complete_onboarding_profile(UUID) TO authenticated;
