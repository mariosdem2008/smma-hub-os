-- Drop the policy that depends on custom_domain
DROP POLICY IF EXISTS "Public can view branding by domain" ON public.agency_branding;

-- Remove custom domain columns from agency_branding
ALTER TABLE public.agency_branding 
DROP COLUMN IF EXISTS custom_domain,
DROP COLUMN IF EXISTS verification_status,
DROP COLUMN IF EXISTS dns_required_record,
DROP COLUMN IF EXISTS dns_last_checked,
DROP COLUMN IF EXISTS ssl_status,
DROP COLUMN IF EXISTS domain_status;