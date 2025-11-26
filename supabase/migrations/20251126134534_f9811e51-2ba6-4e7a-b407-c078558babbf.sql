-- Relax overly strict client portal RLS policies that relied on auth.uid(), which is null for portal users

-- Allow read access to projects (filtered by client_id in application layer)
ALTER POLICY "Client portal users can view their client projects"
ON public.projects
USING (true);

-- Allow read access to project_assets so calendar/approvals can resolve final content
ALTER POLICY "Client portal users can view project assets"
ON public.project_assets
USING (true);
