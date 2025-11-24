-- Remove unused portal_share_token field which poses a security risk
ALTER TABLE public.clients DROP COLUMN IF EXISTS portal_share_token;

-- Add comment documenting portal access security model
COMMENT ON COLUMN public.clients.portal_slug IS 'Unique slug for client portal URL. Portal access requires authenticated users with email-based invitation in client_portal_users table.';
COMMENT ON COLUMN public.clients.portal_enabled IS 'Controls whether client portal is active. Access still requires authenticated user with valid invitation.';

-- Ensure sensitive client data is protected
COMMENT ON COLUMN public.clients.email IS 'Client contact email - restricted by RLS to agency members only';
COMMENT ON COLUMN public.clients.phone IS 'Client contact phone - restricted by RLS to agency members only';
COMMENT ON COLUMN public.clients.company IS 'Client company name - restricted by RLS to agency members only';