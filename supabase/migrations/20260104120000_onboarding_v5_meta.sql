-- Add V5 metadata column for client onboarding profiles
ALTER TABLE public.client_onboarding_profiles
  ADD COLUMN IF NOT EXISTS v5_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Ensure client index exists (used by V5 autosave lookups)
CREATE INDEX IF NOT EXISTS idx_onboarding_profiles_client
  ON public.client_onboarding_profiles(client_id);

-- Optional GIN index for metadata queries
CREATE INDEX IF NOT EXISTS idx_onboarding_profiles_v5_meta
  ON public.client_onboarding_profiles USING GIN (v5_meta);