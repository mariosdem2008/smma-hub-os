-- Drop the overly permissive policy that exposes all client portal users
DROP POLICY IF EXISTS "Users can check their own portal invitation" ON public.client_portal_users;

-- Create a secure function to check portal invitation by email and client
-- This prevents email harvesting while allowing legitimate invitation checks
CREATE OR REPLACE FUNCTION public.check_portal_invitation(_client_id uuid, _email text)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  accepted_at timestamp with time zone,
  expires_at timestamp with time zone,
  name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    user_id,
    accepted_at,
    expires_at,
    name
  FROM public.client_portal_users
  WHERE client_id = _client_id
    AND LOWER(email) = LOWER(_email)
  LIMIT 1;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.check_portal_invitation TO authenticated, anon;

-- Add comment documenting the security model
COMMENT ON FUNCTION public.check_portal_invitation IS 'Securely checks if a specific email has a portal invitation for a specific client. Prevents email enumeration by requiring both client_id and email.';