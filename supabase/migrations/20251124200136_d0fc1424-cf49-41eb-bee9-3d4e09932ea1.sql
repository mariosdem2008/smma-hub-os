-- Drop and recreate client_contacts_secure view without calling SECURITY DEFINER function
-- This eliminates the security definer view warning by inlining the permission check

DROP VIEW IF EXISTS public.client_contacts_secure;

CREATE VIEW public.client_contacts_secure AS
SELECT 
  c.id,
  c.email,
  c.phone,
  c.company,
  c.agency_id
FROM public.clients c
WHERE EXISTS (
  SELECT 1 
  FROM public.agency_members am
  WHERE am.agency_id = c.agency_id
    AND am.user_id = auth.uid()
    AND am.role IN ('owner', 'admin')
);

-- Grant access to authenticated users
GRANT SELECT ON public.client_contacts_secure TO authenticated;

-- Add comment explaining the view's purpose
COMMENT ON VIEW public.client_contacts_secure IS 'Secure view exposing client contact information (email, phone, company) only to agency owners and admins. Uses RLS on agency_members to enforce permissions without SECURITY DEFINER.';

-- Drop the can_view_client_contacts function since it's no longer needed
DROP FUNCTION IF EXISTS public.can_view_client_contacts(uuid, uuid);