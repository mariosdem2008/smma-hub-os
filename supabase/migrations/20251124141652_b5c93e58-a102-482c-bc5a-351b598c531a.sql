-- Create asset_versions table for version history
CREATE TABLE IF NOT EXISTS public.asset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(asset_id, version_number)
);

-- Add index for faster queries
CREATE INDEX idx_asset_versions_asset_id ON public.asset_versions(asset_id);
CREATE INDEX idx_asset_versions_agency_id ON public.asset_versions(agency_id);

-- Enable RLS
ALTER TABLE public.asset_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for asset_versions
CREATE POLICY "Agency members can view asset versions"
ON public.asset_versions
FOR SELECT
USING (
  agency_id IN (
    SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can create asset versions"
ON public.asset_versions
FOR INSERT
WITH CHECK (
  agency_id IN (
    SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can update asset versions"
ON public.asset_versions
FOR UPDATE
USING (
  agency_id IN (
    SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can delete asset versions"
ON public.asset_versions
FOR DELETE
USING (
  agency_id IN (
    SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
  )
);

-- Enable realtime for asset_versions
ALTER TABLE public.asset_versions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.asset_versions;

-- Add version_number column to assets table if not exists (to track current version)
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS current_version integer DEFAULT 1;