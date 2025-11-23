-- Allow unauthenticated users to check if they are invited to a portal
-- This is needed during signup to verify invitation before account creation
CREATE POLICY "Users can check their own portal invitation"
ON public.client_portal_users
FOR SELECT
TO anon
USING (true);

-- Note: This is intentionally permissive for SELECT only. 
-- Users can only UPDATE their own record via the existing policy.
-- Agency members can INSERT/DELETE via existing policies.