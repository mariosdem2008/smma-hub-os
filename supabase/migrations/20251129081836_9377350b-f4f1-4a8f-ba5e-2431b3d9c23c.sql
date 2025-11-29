-- ============================================
-- FIX ALL SECURITY DEFINER VIEWS
-- Convert to SECURITY INVOKER for proper RLS enforcement
-- ============================================

-- 1. Fix client_portal_view
-- This view excludes sensitive contact info (email, phone, company)
DROP VIEW IF EXISTS public.client_portal_view CASCADE;

CREATE VIEW public.client_portal_view
WITH (security_invoker = true) AS
SELECT
  id,
  name,
  logo_url,
  website,
  niche,
  notes,
  tone_of_voice,
  primary_font,
  secondary_font,
  brand_colors,
  portal_enabled,
  portal_slug,
  agency_id,
  created_at,
  updated_at
FROM public.clients;

GRANT SELECT ON public.client_portal_view TO authenticated;

COMMENT ON VIEW public.client_portal_view IS 'SECURITY INVOKER view excluding sensitive contact info (email, phone, company). Respects RLS policies of the querying user.';

-- 2. Fix client_contacts_secure
-- This view includes sensitive contact info, respects RLS
DROP VIEW IF EXISTS public.client_contacts_secure CASCADE;

CREATE VIEW public.client_contacts_secure
WITH (security_invoker = true) AS
SELECT
  c.id,
  c.email,
  c.phone,
  c.company,
  c.agency_id
FROM public.clients c;

GRANT SELECT ON public.client_contacts_secure TO authenticated;

COMMENT ON VIEW public.client_contacts_secure IS 'SECURITY INVOKER view of client contact information. RLS policies control access - only agency members can view their agency''s client contacts.';

-- 3. Fix social_connections_safe
-- This view EXCLUDES OAuth tokens for general display
DROP VIEW IF EXISTS public.social_connections_safe CASCADE;

CREATE VIEW public.social_connections_safe
WITH (security_invoker = true) AS
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

COMMENT ON VIEW public.social_connections_safe IS 'SECURITY INVOKER view of social connections WITHOUT access/refresh tokens. Respects RLS policies. Use this for displaying connection status and account info.';

-- 4. Add security documentation
COMMENT ON COLUMN public.clients.email IS 'SENSITIVE: Client email - accessible via client_contacts_secure view, subject to RLS policies';
COMMENT ON COLUMN public.clients.phone IS 'SENSITIVE: Client phone - accessible via client_contacts_secure view, subject to RLS policies';
COMMENT ON COLUMN public.clients.company IS 'SENSITIVE: Client company - accessible via client_contacts_secure view, subject to RLS policies';

COMMENT ON COLUMN public.social_connections.access_token IS 'CRITICAL SENSITIVE: OAuth access token - NEVER select directly. Use get_social_connection_tokens() function only when needed for API calls.';
COMMENT ON COLUMN public.social_connections.refresh_token IS 'CRITICAL SENSITIVE: OAuth refresh token - NEVER select directly. Use get_social_connection_tokens() function only when needed for token refresh.';