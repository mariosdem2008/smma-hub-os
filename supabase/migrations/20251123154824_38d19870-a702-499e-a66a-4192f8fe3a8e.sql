-- Fix RLS for client portal asset uploads

-- Drop the existing policy
DROP POLICY IF EXISTS "Client portal users can upload assets" ON public.assets;

-- Create a simpler policy that allows unauthenticated inserts for client uploads
CREATE POLICY "Allow client portal uploads"
ON public.assets
FOR INSERT
TO anon
WITH CHECK (
  is_client_upload = true
  AND client_id IN (
    SELECT id FROM public.clients
    WHERE portal_enabled = true
  )
);

-- Drop existing storage policy if it exists
DROP POLICY IF EXISTS "Allow client asset uploads" ON storage.objects;

-- Ensure storage bucket allows client uploads
CREATE POLICY "Allow client asset uploads"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'client-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.clients
    WHERE portal_enabled = true
  )
);