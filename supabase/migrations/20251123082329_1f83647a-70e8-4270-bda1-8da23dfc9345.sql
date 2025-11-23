-- Create storage bucket for client assets if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-assets', 'client-assets', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for client-assets bucket
CREATE POLICY "Agency members can view client assets"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'client-assets' AND
  (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can upload client assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'client-assets' AND
  (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can delete client assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'client-assets' AND
  (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);