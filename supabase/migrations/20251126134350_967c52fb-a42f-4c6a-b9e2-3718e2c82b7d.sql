-- Add RLS policies for client portal users to access projects

-- Client portal users can view projects for their client
CREATE POLICY "Client portal users can view their client projects"
ON public.projects
FOR SELECT
USING (
  client_id IN (
    SELECT client_id 
    FROM client_users 
    WHERE id = auth.uid()
  )
);

-- Client portal users can update projects in review stage (for approval actions)
CREATE POLICY "Client portal users can update review stage projects"
ON public.projects
FOR UPDATE
USING (
  pipeline_stage = 'review'
  AND client_id IN (
    SELECT client_id 
    FROM client_users 
    WHERE id = auth.uid()
  )
);

-- Client portal users can view project assets for their client
CREATE POLICY "Client portal users can view project assets"
ON public.project_assets
FOR SELECT
USING (
  project_id IN (
    SELECT id 
    FROM projects 
    WHERE client_id IN (
      SELECT client_id 
      FROM client_users 
      WHERE id = auth.uid()
    )
  )
);