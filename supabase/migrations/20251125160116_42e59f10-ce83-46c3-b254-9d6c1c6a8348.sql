-- Add per-platform captions to assets table (final_caption, platforms, scheduled_time, post_url already exist)
ALTER TABLE public.assets
ADD COLUMN IF NOT EXISTS platform_captions JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.assets.platform_captions IS 'Platform-specific captions: {"instagram": "caption", "facebook": "caption"}';

-- Fix client_uploads RLS policies
-- Drop existing incomplete policies
DROP POLICY IF EXISTS "Agency members can view client uploads" ON public.client_uploads;
DROP POLICY IF EXISTS "Agency members can update upload status" ON public.client_uploads;
DROP POLICY IF EXISTS "Agency members can delete uploads" ON public.client_uploads;

-- Create comprehensive RLS policies for client_uploads

-- 1. INSERT: Allow client portal users to upload files
CREATE POLICY "Client portal users can upload files"
ON public.client_uploads
FOR INSERT
WITH CHECK (
  uploaded_by IN (
    SELECT id FROM public.client_users
    WHERE client_id = client_uploads.client_id
  )
);

-- 2. SELECT: Agency members can view all client uploads
CREATE POLICY "Agency members can view client uploads"
ON public.client_uploads
FOR SELECT
USING (
  agency_id IN (
    SELECT agency_id FROM agency_members
    WHERE user_id = auth.uid()
  )
);

-- 3. SELECT: Client portal users can view their own uploads
CREATE POLICY "Client users can view their own uploads"
ON public.client_uploads
FOR SELECT
USING (
  uploaded_by IN (
    SELECT id FROM public.client_users
    WHERE client_id = client_uploads.client_id
  )
);

-- 4. UPDATE: Agency members can update upload status (approve/reject)
CREATE POLICY "Agency members can update upload status"
ON public.client_uploads
FOR UPDATE
USING (
  agency_id IN (
    SELECT agency_id FROM agency_members
    WHERE user_id = auth.uid()
  )
);

-- 5. DELETE: Agency members can delete uploads
CREATE POLICY "Agency members can delete uploads"
ON public.client_uploads
FOR DELETE
USING (
  agency_id IN (
    SELECT agency_id FROM agency_members
    WHERE user_id = auth.uid()
  )
);