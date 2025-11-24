-- Drop the overly permissive policy that exposes all client fields to portal users
DROP POLICY IF EXISTS "Client portal users can view their client" ON public.clients;

-- Create a restricted policy for client portal users
-- Note: RLS policies filter ROWS not COLUMNS. The application code must exclude sensitive fields.
CREATE POLICY "Client portal users can view their client data"
ON public.clients
FOR SELECT
TO authenticated
USING (
  is_client_portal_user(id, auth.uid())
  -- Additional safety: ensure portal is enabled
  AND portal_enabled = true
);

-- Create a secure view that exposes only non-sensitive client fields to portal users
CREATE OR REPLACE VIEW public.client_portal_view AS
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

-- Grant access to the view
GRANT SELECT ON public.client_portal_view TO authenticated, anon;

-- Add column-level comments to document which fields are sensitive
COMMENT ON COLUMN public.clients.email IS 'SENSITIVE: Client contact email - restricted to agency members only, MUST NOT be selected by portal users';
COMMENT ON COLUMN public.clients.phone IS 'SENSITIVE: Client contact phone - restricted to agency members only, MUST NOT be selected by portal users';
COMMENT ON COLUMN public.clients.company IS 'SENSITIVE: Client company info - restricted to agency members only, MUST NOT be selected by portal users';

COMMENT ON VIEW public.client_portal_view IS 'Safe view of clients table excluding sensitive contact information (email, phone, company). Use this view for client portal queries.';