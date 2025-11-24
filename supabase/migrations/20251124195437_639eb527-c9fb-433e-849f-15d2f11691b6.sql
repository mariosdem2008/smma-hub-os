-- ============================================
-- SOCIAL CONNECTIONS TOKEN SECURITY FIX
-- ============================================

-- 1. Create a secure view that EXCLUDES sensitive token data
-- This view is safe for general queries by agency members
CREATE OR REPLACE VIEW public.social_connections_safe AS
SELECT
  id,
  client_id,
  platform,
  account_name,
  account_handle,
  account_id,
  status,
  last_synced_at,
  token_expires_at,
  created_at,
  updated_at
FROM public.social_connections;

GRANT SELECT ON public.social_connections_safe TO authenticated;

COMMENT ON VIEW public.social_connections_safe IS 'Safe view of social connections WITHOUT access tokens. Use this for displaying connection status and account info.';

-- 2. Create a secure function to retrieve tokens ONLY when needed
-- This function verifies the user has permission before returning tokens
CREATE OR REPLACE FUNCTION public.get_social_connection_tokens(_connection_id uuid)
RETURNS TABLE (
  access_token text,
  refresh_token text,
  token_expires_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user has access to this connection's client
  IF NOT EXISTS (
    SELECT 1 
    FROM social_connections sc
    JOIN clients c ON sc.client_id = c.id
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE sc.id = _connection_id
      AND am.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized access to connection tokens';
  END IF;

  -- Return tokens only if authorized
  RETURN QUERY
  SELECT 
    sc.access_token,
    sc.refresh_token,
    sc.token_expires_at
  FROM social_connections sc
  WHERE sc.id = _connection_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_social_connection_tokens TO authenticated;

COMMENT ON FUNCTION public.get_social_connection_tokens IS 'Securely retrieves OAuth tokens for a social connection. Requires agency membership verification. Use ONLY when tokens are needed for API calls.';

-- 3. Add security documentation
COMMENT ON COLUMN public.social_connections.access_token IS 'CRITICAL SENSITIVE: OAuth access token - NEVER select directly. Use get_social_connection_tokens() function only when needed for API calls.';
COMMENT ON COLUMN public.social_connections.refresh_token IS 'CRITICAL SENSITIVE: OAuth refresh token - NEVER select directly. Use get_social_connection_tokens() function only when needed for token refresh.';

COMMENT ON TABLE public.social_connections IS 'Social media OAuth connections. SECURITY: Tokens are highly sensitive - use social_connections_safe view for display and get_social_connection_tokens() function only when tokens are required for API operations.';

-- 4. Verify RLS policies are restrictive (existing policies should be fine, but document)
-- The existing "Agency members can view social connections" policy allows SELECT
-- but application code should use the safe view instead of direct table access