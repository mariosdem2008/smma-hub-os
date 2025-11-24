-- Create client_uploads table for safe upload system
CREATE TABLE IF NOT EXISTS public.client_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size integer,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_uploads ENABLE ROW LEVEL SECURITY;

-- Client portal users can insert their own uploads
CREATE POLICY "Client portal users can upload files"
ON public.client_uploads
FOR INSERT
WITH CHECK (
  client_id IN (
    SELECT client_id FROM public.client_portal_users
    WHERE user_id = auth.uid()
  )
  AND uploaded_by = auth.uid()
);

-- Client portal users can view their own uploads
CREATE POLICY "Client portal users can view own uploads"
ON public.client_uploads
FOR SELECT
USING (
  client_id IN (
    SELECT client_id FROM public.client_portal_users
    WHERE user_id = auth.uid()
  )
  AND uploaded_by = auth.uid()
);

-- Agency members can view all uploads for their clients
CREATE POLICY "Agency members can view client uploads"
ON public.client_uploads
FOR SELECT
USING (
  agency_id IN (
    SELECT agency_id FROM public.agency_members
    WHERE user_id = auth.uid()
  )
);

-- Agency members can update upload status
CREATE POLICY "Agency members can update upload status"
ON public.client_uploads
FOR UPDATE
USING (
  agency_id IN (
    SELECT agency_id FROM public.agency_members
    WHERE user_id = auth.uid()
  )
);

-- Agency members can delete uploads
CREATE POLICY "Agency members can delete uploads"
ON public.client_uploads
FOR DELETE
USING (
  agency_id IN (
    SELECT agency_id FROM public.agency_members
    WHERE user_id = auth.uid()
  )
);

-- Create storage bucket for client uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-uploads', 'client-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for client uploads bucket
CREATE POLICY "Client portal users can upload to client-uploads"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'client-uploads'
  AND auth.uid() IN (
    SELECT user_id FROM public.client_portal_users
  )
);

CREATE POLICY "Client portal users can view own uploads"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'client-uploads'
  AND auth.uid() IN (
    SELECT user_id FROM public.client_portal_users
  )
);

CREATE POLICY "Agency members can view client uploads"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'client-uploads'
  AND auth.uid() IN (
    SELECT user_id FROM public.agency_members
  )
);

CREATE POLICY "Agency members can delete client uploads"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'client-uploads'
  AND auth.uid() IN (
    SELECT user_id FROM public.agency_members
  )
);

-- Enable realtime for client_uploads
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_uploads;