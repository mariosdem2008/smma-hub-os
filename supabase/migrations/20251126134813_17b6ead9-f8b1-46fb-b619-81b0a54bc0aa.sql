-- Add RLS policies for client portal users to view assets linked to their projects

-- Client portal users can view assets that belong to their client's projects
CREATE POLICY "Client portal users can view project-linked assets"
ON public.assets
FOR SELECT
USING (
  id IN (
    SELECT pa.asset_id 
    FROM project_assets pa
    JOIN projects p ON pa.project_id = p.id
    WHERE p.client_id IN (
      SELECT client_id 
      FROM client_users 
      WHERE id = auth.uid()
    )
  )
);
