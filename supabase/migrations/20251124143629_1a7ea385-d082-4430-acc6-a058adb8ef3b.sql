-- Add thumbnail_url column to assets table
ALTER TABLE public.assets ADD COLUMN thumbnail_url TEXT;

-- Create asset_comments table
CREATE TABLE public.asset_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on asset_comments
ALTER TABLE public.asset_comments ENABLE ROW LEVEL SECURITY;

-- Agency members can view comments for their agency's assets
CREATE POLICY "Agency members can view asset comments"
  ON public.asset_comments
  FOR SELECT
  USING (
    asset_id IN (
      SELECT a.id
      FROM public.assets a
      JOIN public.clients c ON a.client_id = c.id
      JOIN public.agency_members am ON c.agency_id = am.agency_id
      WHERE am.user_id = auth.uid()
    )
  );

-- Agency members can create comments
CREATE POLICY "Agency members can create asset comments"
  ON public.asset_comments
  FOR INSERT
  WITH CHECK (
    asset_id IN (
      SELECT a.id
      FROM public.assets a
      JOIN public.clients c ON a.client_id = c.id
      JOIN public.agency_members am ON c.agency_id = am.agency_id
      WHERE am.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- Client portal users can view comments on visible assets
CREATE POLICY "Client portal users can view asset comments"
  ON public.asset_comments
  FOR SELECT
  USING (
    asset_id IN (
      SELECT a.id
      FROM public.assets a
      WHERE a.visible_to_client = true
      AND a.client_id IN (
        SELECT client_id FROM public.client_portal_users WHERE user_id = auth.uid()
      )
    )
  );

-- Client portal users can create comments on visible assets
CREATE POLICY "Client portal users can create asset comments"
  ON public.asset_comments
  FOR INSERT
  WITH CHECK (
    asset_id IN (
      SELECT a.id
      FROM public.assets a
      WHERE a.visible_to_client = true
      AND a.client_id IN (
        SELECT client_id FROM public.client_portal_users WHERE user_id = auth.uid()
      )
    )
    AND user_id = auth.uid()
  );

-- Agency members can delete their own comments
CREATE POLICY "Users can delete their own asset comments"
  ON public.asset_comments
  FOR DELETE
  USING (user_id = auth.uid());

-- Enable realtime for asset_comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.asset_comments;

-- Create index for faster queries
CREATE INDEX idx_asset_comments_asset_id ON public.asset_comments(asset_id);
CREATE INDEX idx_asset_comments_created_at ON public.asset_comments(created_at DESC);