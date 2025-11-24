-- Remove the overly permissive policy that exposes all invites
DROP POLICY IF EXISTS "Anyone can view invite by token" ON public.agency_invites;

-- Create a secure function to validate and fetch invite by specific token
-- This prevents enumeration and only returns data when exact token is provided
CREATE OR REPLACE FUNCTION public.get_agency_invite_by_token(_token text)
RETURNS TABLE (
  id uuid,
  agency_id uuid,
  email text,
  role text,
  expires_at timestamp with time zone,
  accepted boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    agency_id,
    email,
    role,
    expires_at,
    accepted
  FROM public.agency_invites
  WHERE token = _token
    AND accepted = FALSE
    AND expires_at > NOW()
  LIMIT 1;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.get_agency_invite_by_token TO authenticated, anon;

-- Add comment documenting the security model
COMMENT ON FUNCTION public.get_agency_invite_by_token IS 'Securely retrieves invitation details by exact token match. Prevents email harvesting by not exposing the invites table directly.';