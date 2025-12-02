-- Add explicit deny-all RLS policy for client_refresh_tokens
CREATE POLICY no_access_client_refresh_tokens
ON public.client_refresh_tokens
FOR ALL
USING (false)
WITH CHECK (false);