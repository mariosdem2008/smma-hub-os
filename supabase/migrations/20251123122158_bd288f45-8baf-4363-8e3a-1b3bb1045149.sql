-- Drop the problematic policy
DROP POLICY IF EXISTS "Client portal users can view assigned client" ON public.clients;

-- Create security definer function to check portal access
CREATE OR REPLACE FUNCTION public.is_client_portal_user(_client_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_portal_users
    WHERE user_id = _user_id
      AND client_id = _client_id
  );
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "Client portal users can view assigned client"
ON public.clients
FOR SELECT
USING (public.is_client_portal_user(id, auth.uid()));