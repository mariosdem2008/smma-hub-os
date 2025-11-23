-- Remove client upload RLS policies

-- Drop the client portal upload policies
DROP POLICY IF EXISTS "Allow client portal uploads" ON public.assets;
DROP POLICY IF EXISTS "Allow client asset uploads" ON storage.objects;

-- Remove the is_client_upload based SELECT policy for portal users
DROP POLICY IF EXISTS "Client portal users can view visible assets" ON public.assets;

-- Recreate the portal view policy without is_client_upload logic
CREATE POLICY "Client portal users can view visible assets"
ON public.assets
FOR SELECT
TO public
USING (
  visible_to_client = true
  AND client_id IN (
    SELECT id FROM public.clients
    WHERE portal_enabled = true
  )
);