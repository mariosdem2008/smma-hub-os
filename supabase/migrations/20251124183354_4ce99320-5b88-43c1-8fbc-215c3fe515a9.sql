-- Add DNS verification fields to agency_branding
ALTER TABLE public.agency_branding
ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'not_configured',
ADD COLUMN IF NOT EXISTS dns_required_record text,
ADD COLUMN IF NOT EXISTS dns_last_checked timestamptz,
ADD COLUMN IF NOT EXISTS ssl_status text DEFAULT 'pending';

-- Add check constraints for valid statuses
ALTER TABLE public.agency_branding
DROP CONSTRAINT IF EXISTS valid_verification_status,
ADD CONSTRAINT valid_verification_status 
  CHECK (verification_status IN ('not_configured', 'pending', 'verified', 'failed'));

ALTER TABLE public.agency_branding
DROP CONSTRAINT IF EXISTS valid_ssl_status,
ADD CONSTRAINT valid_ssl_status 
  CHECK (ssl_status IN ('pending', 'active', 'failed'));