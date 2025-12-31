-- ============================================================================
-- Grant permissions on client_onboarding_profiles table
-- This was missing from the original migration
-- ============================================================================

-- Grant table permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_onboarding_profiles TO authenticated;

-- Grant usage on sequences if any
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
