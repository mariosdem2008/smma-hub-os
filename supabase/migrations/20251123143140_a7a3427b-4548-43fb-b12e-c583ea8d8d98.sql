-- Allow unauthenticated users to read minimal client data for enabled portals
CREATE POLICY "Public can view enabled client portals"
ON public.clients
FOR SELECT
USING (portal_enabled = true);
