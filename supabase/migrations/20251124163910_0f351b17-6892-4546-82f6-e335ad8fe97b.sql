-- Extend agency_branding table with new fields
ALTER TABLE public.agency_branding
ADD COLUMN IF NOT EXISTS favicon_url text,
ADD COLUMN IF NOT EXISTS font_primary text DEFAULT 'Inter',
ADD COLUMN IF NOT EXISTS font_secondary text DEFAULT 'Inter',
ADD COLUMN IF NOT EXISTS layout_style text DEFAULT 'default' CHECK (layout_style IN ('default', 'modern', 'minimal', 'bold')),
ADD COLUMN IF NOT EXISTS email_footer text,
ADD COLUMN IF NOT EXISTS section_labels jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS domain_status text DEFAULT 'pending' CHECK (domain_status IN ('pending', 'verified', 'failed'));

-- Create storage buckets for branding assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('branding-assets', 'branding-assets', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon']::text[]),
  ('portal-themes', 'portal-themes', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp']::text[])
ON CONFLICT (id) DO NOTHING;

-- RLS for branding-assets bucket
CREATE POLICY "Agency members can upload branding assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'branding-assets' AND
  (storage.foldername(name))[1] IN (
    SELECT am.agency_id::text
    FROM agency_members am
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can update branding assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'branding-assets' AND
  (storage.foldername(name))[1] IN (
    SELECT am.agency_id::text
    FROM agency_members am
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can delete branding assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'branding-assets' AND
  (storage.foldername(name))[1] IN (
    SELECT am.agency_id::text
    FROM agency_members am
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Public can view branding assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'branding-assets');

-- RLS for portal-themes bucket
CREATE POLICY "Agency members can upload portal themes"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'portal-themes' AND
  (storage.foldername(name))[1] IN (
    SELECT am.agency_id::text
    FROM agency_members am
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Public can view portal themes"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'portal-themes');