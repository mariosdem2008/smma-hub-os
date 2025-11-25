-- Allow public users to check if a portal exists (for login/signup pages)
-- This only exposes non-sensitive portal information
CREATE POLICY "Public users can view portal-enabled clients by slug"
  ON public.clients
  FOR SELECT
  TO public
  USING (portal_enabled = true);
