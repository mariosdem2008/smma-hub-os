-- Fix RLS policies for project_assets table
-- Remove the overly permissive policy for client users

DROP POLICY IF EXISTS "Client portal users can view project assets" ON public.project_assets;

-- Create proper client user policy that checks client_id through projects
CREATE POLICY "client_users_view_project_assets" ON public.project_assets
FOR SELECT USING (
  project_id IN (
    SELECT p.id FROM projects p
    WHERE p.client_id IN (
      SELECT client_id FROM client_users WHERE id = auth.uid()
    )
  )
);