-- Add policy to allow updating user_id for portal users on first login
CREATE POLICY "Portal users can link their account on first login"
ON public.client_portal_users
FOR UPDATE
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
  AND user_id IS NULL
)
WITH CHECK (
  user_id = auth.uid()
);