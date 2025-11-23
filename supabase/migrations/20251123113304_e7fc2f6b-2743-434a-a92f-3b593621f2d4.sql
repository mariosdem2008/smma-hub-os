-- Add font columns to clients table
ALTER TABLE public.clients
ADD COLUMN primary_font TEXT,
ADD COLUMN secondary_font TEXT;

-- Create storage bucket for custom client fonts
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-fonts', 'client-fonts', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for client-fonts bucket
CREATE POLICY "Agency members can upload client fonts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'client-fonts' AND
  (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can view client fonts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-fonts' AND
  (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can delete client fonts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'client-fonts' AND
  (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Public can view client fonts"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'client-fonts');