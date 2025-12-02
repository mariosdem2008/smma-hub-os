-- Pipeline Comments Table
CREATE TABLE public.pipeline_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_agency_member uuid REFERENCES public.agency_members(id) ON DELETE SET NULL,
  author_client_user uuid REFERENCES public.client_users(id) ON DELETE SET NULL,
  body text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Ensure at least one author is set
  CONSTRAINT pipeline_comments_author_check CHECK (
    (author_agency_member IS NOT NULL) OR (author_client_user IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_pipeline_comments_project_id ON public.pipeline_comments(project_id);
CREATE INDEX idx_pipeline_comments_created_at ON public.pipeline_comments(created_at DESC);

-- Enable RLS
ALTER TABLE public.pipeline_comments ENABLE ROW LEVEL SECURITY;

-- Agency members can view all comments for their projects
CREATE POLICY "agency_members_view_comments"
ON public.pipeline_comments
FOR SELECT
USING (
  project_id IN (
    SELECT p.id FROM public.projects p
    WHERE p.agency_id IN (
      SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
    )
  )
);

-- Agency members can create comments
CREATE POLICY "agency_members_create_comments"
ON public.pipeline_comments
FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT p.id FROM public.projects p
    WHERE p.agency_id IN (
      SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
    )
  )
);

-- Agency members can delete their own comments
CREATE POLICY "agency_members_delete_own_comments"
ON public.pipeline_comments
FOR DELETE
USING (
  author_agency_member IN (
    SELECT id FROM public.agency_members WHERE user_id = auth.uid()
  )
);

-- Client users can view non-internal comments for their client's projects
CREATE POLICY "client_users_view_external_comments"
ON public.pipeline_comments
FOR SELECT
USING (
  is_internal = false
  AND project_id IN (
    SELECT p.id FROM public.projects p
    WHERE p.client_id IN (
      SELECT client_id FROM public.client_users WHERE id = auth.uid()
    )
  )
);

-- Client users can create external comments
CREATE POLICY "client_users_create_external_comments"
ON public.pipeline_comments
FOR INSERT
WITH CHECK (
  is_internal = false
  AND project_id IN (
    SELECT p.id FROM public.projects p
    WHERE p.client_id IN (
      SELECT client_id FROM public.client_users WHERE id = auth.uid()
    )
  )
);

-- Client users can delete their own comments
CREATE POLICY "client_users_delete_own_comments"
ON public.pipeline_comments
FOR DELETE
USING (
  author_client_user = auth.uid()
);

-- Activity Logs Table
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  actor_agency_member uuid REFERENCES public.agency_members(id) ON DELETE SET NULL,
  actor_client_user uuid REFERENCES public.client_users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_activity_logs_project_id ON public.activity_logs(project_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action_type ON public.activity_logs(action_type);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Agency members can view activity logs for their projects
CREATE POLICY "agency_members_view_activity_logs"
ON public.activity_logs
FOR SELECT
USING (
  project_id IN (
    SELECT p.id FROM public.projects p
    WHERE p.agency_id IN (
      SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
    )
  )
);

-- Agency members can create activity logs
CREATE POLICY "agency_members_create_activity_logs"
ON public.activity_logs
FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT p.id FROM public.projects p
    WHERE p.agency_id IN (
      SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
    )
  )
);

-- Client users can view activity logs for their client's projects
CREATE POLICY "client_users_view_activity_logs"
ON public.activity_logs
FOR SELECT
USING (
  project_id IN (
    SELECT p.id FROM public.projects p
    WHERE p.client_id IN (
      SELECT client_id FROM public.client_users WHERE id = auth.uid()
    )
  )
);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;