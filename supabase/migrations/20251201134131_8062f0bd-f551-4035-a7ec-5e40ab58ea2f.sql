-- Create project_activities table for tracking all project actions
CREATE TABLE IF NOT EXISTS public.project_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  actor_type text NOT NULL CHECK (actor_type IN ('agency', 'client', 'system')),
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('created', 'approved', 'changes_requested', 'status_changed', 'scheduled', 'published', 'failed')),
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_project_activities_project_id ON public.project_activities(project_id);
CREATE INDEX idx_project_activities_agency_id ON public.project_activities(agency_id);
CREATE INDEX idx_project_activities_client_id ON public.project_activities(client_id);
CREATE INDEX idx_project_activities_created_at ON public.project_activities(created_at DESC);

-- Enable RLS
ALTER TABLE public.project_activities ENABLE ROW LEVEL SECURITY;

-- Agency members can view all activities for their agency's projects
CREATE POLICY "Agency members can view project activities"
ON public.project_activities
FOR SELECT
TO authenticated
USING (
  agency_id IN (
    SELECT agency_id 
    FROM public.agency_members 
    WHERE user_id = auth.uid()
  )
);

-- Agency members can insert activities for their agency's projects
CREATE POLICY "Agency members can insert project activities"
ON public.project_activities
FOR INSERT
TO authenticated
WITH CHECK (
  agency_id IN (
    SELECT agency_id 
    FROM public.agency_members 
    WHERE user_id = auth.uid()
  )
);

-- Client portal users can view activities for their client's projects
CREATE POLICY "Client portal users can view their project activities"
ON public.project_activities
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT client_id 
    FROM public.client_users 
    WHERE id = auth.uid()
  )
);

-- Client portal users can insert activities for their projects
CREATE POLICY "Client portal users can insert their project activities"
ON public.project_activities
FOR INSERT
TO authenticated
WITH CHECK (
  client_id IN (
    SELECT client_id 
    FROM public.client_users 
    WHERE id = auth.uid()
  ) AND actor_type = 'client'
);

-- Update projects RLS to allow client portal users to update status during approval
CREATE POLICY "Client portal users can approve projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  client_id IN (
    SELECT client_id 
    FROM public.client_users 
    WHERE id = auth.uid()
  ) AND status = 'client_review'
)
WITH CHECK (
  client_id IN (
    SELECT client_id 
    FROM public.client_users 
    WHERE id = auth.uid()
  ) AND status IN ('approved', 'production')
);