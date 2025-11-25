-- Storage RLS for private client uploads bucket
-- Allow client portal users to upload files to client-uploads
CREATE POLICY "Client users can upload to client-uploads"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'client-uploads'
  AND auth.uid() IN (
    SELECT cu.id
    FROM public.client_users cu
    WHERE cu.client_id::text = (storage.foldername(name))[1]
  )
);

-- Client users can read their own client's uploads
CREATE POLICY "Client users can view their client-uploads"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'client-uploads'
  AND auth.uid() IN (
    SELECT cu.id
    FROM public.client_users cu
    WHERE cu.client_id::text = (storage.foldername(name))[1]
  )
);

-- Agency members can view uploads for their clients
CREATE POLICY "Agency members can view client-uploads"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'client-uploads'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT c.id
    FROM public.clients c
    JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

-- Agency members can delete uploads for their clients
CREATE POLICY "Agency members can delete client-uploads"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'client-uploads'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT c.id
    FROM public.clients c
    JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);