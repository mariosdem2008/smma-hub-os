-- =====================================================
-- NORMALIZE CONTENT PIPELINE & SCHEDULING DATA MODEL
-- =====================================================

-- 1. Create enum for project status (8-stage pipeline)
CREATE TYPE public.project_status AS ENUM (
  'idea',
  'scripting', 
  'production',
  'internal_review',
  'client_review',
  'approved',
  'scheduled',
  'published'
);

-- 2. Update projects table to standardize fields
ALTER TABLE public.projects
  -- Add new status field with enum type
  ADD COLUMN IF NOT EXISTS status project_status DEFAULT 'idea',
  -- Add description field
  ADD COLUMN IF NOT EXISTS description text,
  -- Add scheduled_for as the canonical scheduled datetime
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  -- Add published_at timestamp
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  -- Add time_zone field
  ADD COLUMN IF NOT EXISTS time_zone text DEFAULT 'UTC';

-- 3. Migrate existing pipeline_stage data to new status field
UPDATE public.projects
SET status = CASE
  WHEN pipeline_stage = 'idea' THEN 'idea'::project_status
  WHEN pipeline_stage = 'scripting' THEN 'scripting'::project_status
  WHEN pipeline_stage = 'in_production' THEN 'production'::project_status
  WHEN pipeline_stage = 'review' THEN 'internal_review'::project_status
  WHEN pipeline_stage = 'client_review' THEN 'client_review'::project_status
  WHEN pipeline_stage = 'approved' THEN 'approved'::project_status
  WHEN pipeline_stage = 'scheduled' THEN 'scheduled'::project_status
  WHEN pipeline_stage = 'published' THEN 'published'::project_status
  ELSE 'idea'::project_status
END
WHERE status IS NULL;

-- 4. Migrate scheduled_time to scheduled_for
UPDATE public.projects
SET scheduled_for = scheduled_time
WHERE scheduled_time IS NOT NULL AND scheduled_for IS NULL;

-- 5. Create scheduled_posts table for per-platform scheduling
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('instagram', 'facebook', 'linkedin', 'tiktok', 'youtube')),
  social_connection_id uuid REFERENCES public.social_connections(id) ON DELETE SET NULL,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'publishing', 'published', 'failed', 'cancelled')),
  error_message text,
  published_at timestamptz,
  platform_post_id text,
  platform_permalink text,
  caption text,
  hashtags text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Create indexes for scheduled_posts
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_project_id ON public.scheduled_posts(project_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_agency_id ON public.scheduled_posts(agency_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_client_id ON public.scheduled_posts(client_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON public.scheduled_posts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_for ON public.scheduled_posts(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_platform ON public.scheduled_posts(platform);

-- 7. Enable RLS on scheduled_posts
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies for scheduled_posts - Agency members
CREATE POLICY "Agency members can manage scheduled posts"
ON public.scheduled_posts
FOR ALL
TO authenticated
USING (
  agency_id IN (
    SELECT agency_id 
    FROM public.agency_members 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  agency_id IN (
    SELECT agency_id 
    FROM public.agency_members 
    WHERE user_id = auth.uid()
  )
);

-- 9. RLS Policies for scheduled_posts - Client portal users (read-only)
CREATE POLICY "Client portal users can view their scheduled posts"
ON public.scheduled_posts
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT client_id 
    FROM public.client_users 
    WHERE id = auth.uid()
  )
);

-- 10. Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_scheduled_posts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_scheduled_posts_updated_at
BEFORE UPDATE ON public.scheduled_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_scheduled_posts_updated_at();

-- 11. Update existing projects RLS to include new status field
-- (Existing policies remain, just ensuring they work with new schema)

-- 12. Create helper function to transition project status
CREATE OR REPLACE FUNCTION public.transition_project_status(
  _project_id uuid,
  _new_status project_status
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project RECORD;
  v_agency_id uuid;
BEGIN
  -- Fetch project
  SELECT * INTO v_project
  FROM public.projects
  WHERE id = _project_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Project not found'
    );
  END IF;

  -- Check authorization
  IF NOT EXISTS (
    SELECT 1 
    FROM public.agency_members
    WHERE agency_id = v_project.agency_id
      AND user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized'
    );
  END IF;

  -- Update status
  UPDATE public.projects
  SET status = _new_status,
      updated_at = now()
  WHERE id = _project_id;

  RETURN jsonb_build_object(
    'success', true,
    'project_id', _project_id,
    'old_status', v_project.status,
    'new_status', _new_status
  );
END;
$$;

-- 13. Add comment documentation
COMMENT ON TABLE public.scheduled_posts IS 'Per-platform scheduling records for projects. One project can have multiple scheduled_posts (one per platform).';
COMMENT ON COLUMN public.projects.status IS '8-stage pipeline status: idea → scripting → production → internal_review → client_review → approved → scheduled → published';
COMMENT ON COLUMN public.scheduled_posts.status IS 'Publishing status: pending → queued → publishing → published | failed | cancelled';