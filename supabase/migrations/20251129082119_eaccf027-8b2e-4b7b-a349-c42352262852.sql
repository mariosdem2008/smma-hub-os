-- ============================================
-- PRODUCTION LOGGING ENHANCEMENTS
-- ============================================

-- 1. Enhance post_logs table
ALTER TABLE public.post_logs
ADD COLUMN IF NOT EXISTS duration_ms integer,
ADD COLUMN IF NOT EXISTS published_permalink text,
ADD COLUMN IF NOT EXISTS request jsonb;

COMMENT ON COLUMN public.post_logs.duration_ms IS 'Time taken for the post operation in milliseconds';
COMMENT ON COLUMN public.post_logs.published_permalink IS 'Final published URL/permalink from the social platform';
COMMENT ON COLUMN public.post_logs.request IS 'Full API request payload (excluding sensitive tokens)';

-- 2. Enhance token_refresh_logs table
ALTER TABLE public.token_refresh_logs
ADD COLUMN IF NOT EXISTS error_code text;

COMMENT ON COLUMN public.token_refresh_logs.old_token_preview IS 'Preview of old access token (first 10 chars)';
COMMENT ON COLUMN public.token_refresh_logs.new_token_preview IS 'Preview of new access token (first 10 chars)';
COMMENT ON COLUMN public.token_refresh_logs.error_code IS 'Error code from failed token refresh attempts';

-- 3. Create project failure tracking table for alerting
CREATE TABLE IF NOT EXISTS public.project_failure_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_failure_at timestamp with time zone,
  alert_sent boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_failure_tracking ENABLE ROW LEVEL SECURITY;

-- Agency members can view their projects' failure tracking
CREATE POLICY "agency_members_view_failure_tracking"
ON public.project_failure_tracking
FOR SELECT
TO authenticated
USING (
  project_id IN (
    SELECT p.id
    FROM public.projects p
    JOIN public.agency_members am ON p.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

-- Only edge functions can manage failure tracking (using service role)
CREATE POLICY "service_role_manage_failure_tracking"
ON public.project_failure_tracking
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMENT ON TABLE public.project_failure_tracking IS 'Tracks consecutive autopost failures for alerting system. Resets on successful post.';

-- 4. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_post_logs_project_created 
  ON public.post_logs(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_logs_success_created 
  ON public.post_logs(success, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_token_refresh_logs_connection_created 
  ON public.token_refresh_logs(social_connection_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_failure_tracking_project 
  ON public.project_failure_tracking(project_id);

-- 5. RLS policies for logs (read-only for agency members)
DROP POLICY IF EXISTS "Agency members can view post logs" ON public.post_logs;
CREATE POLICY "agency_members_view_post_logs"
ON public.post_logs
FOR SELECT
TO authenticated
USING (
  project_id IN (
    SELECT p.id
    FROM public.projects p
    JOIN public.agency_members am ON p.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Agency members can view token refresh logs" ON public.token_refresh_logs;
CREATE POLICY "agency_members_view_token_refresh_logs"
ON public.token_refresh_logs
FOR SELECT
TO authenticated
USING (
  social_connection_id IN (
    SELECT sc.id
    FROM public.social_connections sc
    JOIN public.clients c ON sc.client_id = c.id
    JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);