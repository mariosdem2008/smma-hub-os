-- Remove legacy onboarding session table (V3). Current onboarding uses
-- client_onboarding_profiles + v5_meta for progress, and ClientBrain jobs.

drop table if exists public.client_onboarding_sessions cascade;

