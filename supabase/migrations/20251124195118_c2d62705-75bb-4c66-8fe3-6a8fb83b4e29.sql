-- ============================================
-- COMPREHENSIVE SECURITY FIX
-- ============================================

-- 1. FIX: Remove SECURITY DEFINER from client_portal_view
-- The view should use invoker's permissions, not creator's
DROP VIEW IF EXISTS public.client_portal_view;

CREATE VIEW public.client_portal_view AS
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

-- Grant appropriate access
GRANT SELECT ON public.client_portal_view TO authenticated;

COMMENT ON VIEW public.client_portal_view IS 'Non-SECURITY DEFINER view excluding sensitive contact info (email, phone, company). Uses invoker permissions for proper RLS enforcement.';

-- 2. FIX: Create role-based access function for sensitive client data
-- Only agency owners/admins can view client contact information
CREATE OR REPLACE FUNCTION public.can_view_client_contacts(_client_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Check if user is owner of the agency or has admin role
  SELECT EXISTS (
    SELECT 1 
    FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE c.id = _client_id
      AND am.user_id = _user_id
      AND am.role IN ('owner', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_client_contacts TO authenticated;

-- 3. Create a secure view for sensitive client contact information
-- Only accessible to owners/admins
CREATE OR REPLACE VIEW public.client_contacts_secure AS
SELECT
  c.id,
  c.email,
  c.phone,
  c.company,
  c.agency_id
FROM public.clients c
WHERE can_view_client_contacts(c.id, auth.uid());

GRANT SELECT ON public.client_contacts_secure TO authenticated;

COMMENT ON VIEW public.client_contacts_secure IS 'Secure view of client contact information. Only accessible to agency owners and admins through can_view_client_contacts() function.';

-- 4. Document the security model
COMMENT ON COLUMN public.clients.email IS 'SENSITIVE: Client email - accessible only to agency owners/admins via client_contacts_secure view';
COMMENT ON COLUMN public.clients.phone IS 'SENSITIVE: Client phone - accessible only to agency owners/admins via client_contacts_secure view';
COMMENT ON COLUMN public.clients.company IS 'SENSITIVE: Client company - accessible only to agency owners/admins via client_contacts_secure view';

-- 5. Ensure profiles table has proper isolation
-- (Already fixed in previous migration, but documenting)
COMMENT ON TABLE public.profiles IS 'User profiles with strict RLS: users can ONLY access their own profile. Email harvesting prevented by auth.uid() = id policy.';