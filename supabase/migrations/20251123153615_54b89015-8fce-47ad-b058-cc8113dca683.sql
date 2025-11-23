-- Drop the overly restrictive client portal insert policy
DROP POLICY IF EXISTS "Client portal users can create assets" ON public.assets;

-- Create new policy allowing anyone accessing via portal to upload assets
-- This allows unauthenticated uploads for client portals
CREATE POLICY "Client portal users can upload assets"
ON public.assets
FOR INSERT
TO public
WITH CHECK (
  is_client_upload = true
  AND client_id IN (
    SELECT id FROM public.clients
    WHERE portal_enabled = true
  )
);