-- ============================================================================
-- Add meta_json for Future Flexibility
-- Allows storing additional fields without schema migrations
-- ============================================================================

-- Add meta_json column for future expansion
ALTER TABLE public.client_onboarding_profiles
ADD COLUMN IF NOT EXISTS meta_json JSONB DEFAULT '{}'::jsonb;

-- Add comment
COMMENT ON COLUMN public.client_onboarding_profiles.meta_json IS
  'Flexible JSON field for storing additional data without schema changes. Use for new experimental fields before promoting to typed columns.';

-- Add onboarding_field_events table for detailed provenance tracking
CREATE TABLE IF NOT EXISTS public.onboarding_field_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.client_onboarding_profiles(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('set', 'changed', 'ai_suggested', 'ai_accepted', 'reverted')),
  old_value JSONB,
  new_value JSONB,
  provenance public.answer_provenance,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying field history
CREATE INDEX idx_field_events_profile ON public.onboarding_field_events(profile_id);
CREATE INDEX idx_field_events_field ON public.onboarding_field_events(profile_id, field_name);
CREATE INDEX idx_field_events_time ON public.onboarding_field_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.onboarding_field_events ENABLE ROW LEVEL SECURITY;

-- RLS policy: Agency members can read events for their clients
CREATE POLICY "field_events_select" ON public.onboarding_field_events
  FOR SELECT TO authenticated
  USING (
    profile_id IN (
      SELECT p.id FROM public.client_onboarding_profiles p
      JOIN public.agency_members am ON am.agency_id = p.agency_id
      WHERE am.user_id = auth.uid()
    )
  );

-- RLS policy: Agency members can insert events
CREATE POLICY "field_events_insert" ON public.onboarding_field_events
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT p.id FROM public.client_onboarding_profiles p
      JOIN public.agency_members am ON am.agency_id = p.agency_id
      WHERE am.user_id = auth.uid()
    )
  );

-- Function to log field changes
CREATE OR REPLACE FUNCTION public.log_onboarding_field_event(
  p_profile_id UUID,
  p_field_name TEXT,
  p_event_type TEXT,
  p_old_value JSONB,
  p_new_value JSONB,
  p_provenance public.answer_provenance DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO public.onboarding_field_events (
    profile_id, field_name, event_type, old_value, new_value, provenance, metadata, created_by
  ) VALUES (
    p_profile_id, p_field_name, p_event_type, p_old_value, p_new_value, p_provenance, p_metadata, auth.uid()
  )
  RETURNING id INTO event_id;

  RETURN event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_onboarding_field_event(UUID, TEXT, TEXT, JSONB, JSONB, public.answer_provenance, JSONB) TO authenticated;
