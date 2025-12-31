-- ============================================================================
-- Cleanup Old Onboarding Data Migration
-- Truncates V3 onboarding sessions and unlocks brains for re-onboarding
-- ============================================================================

-- Step 1: Truncate old onboarding sessions
-- This removes all V3 onboarding data as per user requirement
TRUNCATE public.client_onboarding_sessions CASCADE;

-- Step 2: Unlock all client brains to allow re-onboarding
-- This marks all previously locked brains as draft so clients can go through V4 onboarding
UPDATE public.client_brains
SET
  status = 'draft',
  locked = false,
  updated_at = now()
WHERE locked = true;

-- Step 3: Add comment for audit trail
COMMENT ON TABLE public.client_onboarding_sessions IS
  'Legacy V3 onboarding sessions table. Data truncated on 2025-12-30 for V4 migration. Table kept for potential rollback.';
