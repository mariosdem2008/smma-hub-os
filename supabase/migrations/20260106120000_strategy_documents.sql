-- Strategy documents table + storage bucket

CREATE TABLE IF NOT EXISTS public.strategy_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  content_markdown TEXT,
  content_html TEXT,
  source TEXT NOT NULL CHECK (source IN ('ai', 'upload', 'manual')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  generated_by_user_id UUID REFERENCES auth.users(id),
  model TEXT,
  generation_instruction TEXT,
  derived_from_hash TEXT,
  file_path TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strategy_documents_client_active
  ON public.strategy_documents(client_id, is_active, updated_at DESC);

ALTER TABLE public.strategy_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY strategy_documents_select ON public.strategy_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = strategy_documents.agency_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_documents_insert ON public.strategy_documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = strategy_documents.agency_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_documents_update ON public.strategy_documents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = strategy_documents.agency_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_documents_delete ON public.strategy_documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = strategy_documents.agency_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'admin')
    )
  );

CREATE OR REPLACE FUNCTION public.update_strategy_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS strategy_documents_updated_at ON public.strategy_documents;
CREATE TRIGGER strategy_documents_updated_at
  BEFORE UPDATE ON public.strategy_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_strategy_documents_updated_at();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'strategy-documents',
  'strategy-documents',
  true,
  10485760,
  ARRAY[
    'application/pdf',
    'text/markdown',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Agency members can upload strategy documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'strategy-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT am.agency_id::text
    FROM agency_members am
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can delete strategy documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'strategy-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT am.agency_id::text
    FROM agency_members am
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Public can view strategy documents"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'strategy-documents');
