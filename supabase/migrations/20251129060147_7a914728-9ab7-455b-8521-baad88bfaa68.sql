-- Drop all existing RLS policies on projects table
DROP POLICY IF EXISTS "Agency members can create projects" ON public.projects;
DROP POLICY IF EXISTS "Agency members can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Agency members can update projects" ON public.projects;
DROP POLICY IF EXISTS "Agency members can view projects" ON public.projects;
DROP POLICY IF EXISTS "Client portal users can view their client projects" ON public.projects;
DROP POLICY IF EXISTS "Client portal users can update their project reviews" ON public.projects;
DROP POLICY IF EXISTS "Public can view projects for approval" ON public.projects;

-- Enable RLS on projects table
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Create secure policy: Agency members can fully manage projects
CREATE POLICY "Agency members can manage projects"
ON public.projects
FOR ALL
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

-- Create secure policy: Client portal users can only SELECT their own projects
CREATE POLICY "Client portal users can view their projects"
ON public.projects
FOR SELECT
USING (
  client_id IN (
    SELECT client_id 
    FROM public.client_users 
    WHERE id = auth.uid()
  )
);