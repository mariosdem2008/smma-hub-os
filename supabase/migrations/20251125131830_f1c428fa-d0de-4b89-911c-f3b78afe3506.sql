-- AUTOPIPELINE CORE: Unified Content Pipeline System
-- Creates enforced pipeline stages: raw → editing → approval → final → scheduled → published

-- Create enum types for pipeline stages and approval statuses
CREATE TYPE public.pipeline_stage AS ENUM (
  'raw',
  'editing', 
  'approval',
  'final',
  'scheduled',
  'published'
);

CREATE TYPE public.approval_status AS ENUM (
  'pending',
  'approved',
  'changes_requested'
);

-- Update assets table with pipeline fields
ALTER TABLE public.assets
ADD COLUMN IF NOT EXISTS pipeline_stage public.pipeline_stage DEFAULT 'raw',
ADD COLUMN IF NOT EXISTS content_type TEXT,
ADD COLUMN IF NOT EXISTS platforms TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS final_caption TEXT,
ADD COLUMN IF NOT EXISTS hashtags TEXT,
ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS post_url TEXT;

-- Create index on pipeline_stage for efficient querying
CREATE INDEX IF NOT EXISTS idx_assets_pipeline_stage ON public.assets(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_assets_client_pipeline ON public.assets(client_id, pipeline_stage);

-- Update asset_versions table (already exists, add agency_id if missing)
ALTER TABLE public.asset_versions
ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE;

-- Create approval_tasks table
CREATE TABLE IF NOT EXISTS public.approval_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_version_id UUID NOT NULL REFERENCES public.asset_versions(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.approval_status NOT NULL DEFAULT 'pending',
  comments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for approval_tasks
CREATE INDEX IF NOT EXISTS idx_approval_tasks_asset_version ON public.approval_tasks(asset_version_id);
CREATE INDEX IF NOT EXISTS idx_approval_tasks_approver ON public.approval_tasks(approver_id);
CREATE INDEX IF NOT EXISTS idx_approval_tasks_status ON public.approval_tasks(status);

-- Create post_metrics table
CREATE TABLE IF NOT EXISTS public.post_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for post_metrics
CREATE INDEX IF NOT EXISTS idx_post_metrics_post ON public.post_metrics(post_id);
CREATE INDEX IF NOT EXISTS idx_post_metrics_asset ON public.post_metrics(asset_id);
CREATE INDEX IF NOT EXISTS idx_post_metrics_platform ON public.post_metrics(platform);

-- Enable RLS on new tables
ALTER TABLE public.approval_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for approval_tasks
-- Agency members can view approval tasks for their agency's assets
CREATE POLICY "Agency members can view approval tasks"
ON public.approval_tasks
FOR SELECT
USING (
  asset_version_id IN (
    SELECT av.id 
    FROM asset_versions av
    JOIN assets a ON av.asset_id = a.id
    JOIN clients c ON a.client_id = c.id
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

-- Approvers can update their own approval tasks
CREATE POLICY "Approvers can update their approval tasks"
ON public.approval_tasks
FOR UPDATE
USING (approver_id = auth.uid());

-- Agency members can create approval tasks
CREATE POLICY "Agency members can create approval tasks"
ON public.approval_tasks
FOR INSERT
WITH CHECK (
  asset_version_id IN (
    SELECT av.id 
    FROM asset_versions av
    JOIN assets a ON av.asset_id = a.id
    JOIN clients c ON a.client_id = c.id
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

-- Client portal users can view and update approval tasks assigned to them
CREATE POLICY "Client portal users can view their approval tasks"
ON public.approval_tasks
FOR SELECT
USING (
  approver_id = auth.uid() AND
  asset_version_id IN (
    SELECT av.id 
    FROM asset_versions av
    JOIN assets a ON av.asset_id = a.id
    WHERE a.client_id IN (
      SELECT client_id FROM client_portal_users WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Client portal users can update their approval tasks"
ON public.approval_tasks
FOR UPDATE
USING (
  approver_id = auth.uid() AND
  asset_version_id IN (
    SELECT av.id 
    FROM asset_versions av
    JOIN assets a ON av.asset_id = a.id
    WHERE a.client_id IN (
      SELECT client_id FROM client_portal_users WHERE user_id = auth.uid()
    )
  )
);

-- RLS Policies for post_metrics
-- Agency members can view metrics for their agency's posts
CREATE POLICY "Agency members can view post metrics"
ON public.post_metrics
FOR SELECT
USING (
  (post_id IN (
    SELECT p.id FROM posts p
    JOIN clients c ON p.client_id = c.id
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  ))
  OR
  (asset_id IN (
    SELECT a.id FROM assets a
    JOIN clients c ON a.client_id = c.id
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  ))
);

-- Agency members can insert/update post metrics
CREATE POLICY "Agency members can manage post metrics"
ON public.post_metrics
FOR ALL
USING (
  (post_id IN (
    SELECT p.id FROM posts p
    JOIN clients c ON p.client_id = c.id
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  ))
  OR
  (asset_id IN (
    SELECT a.id FROM assets a
    JOIN clients c ON a.client_id = c.id
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  ))
);

-- Client portal users can view metrics for their client's content
CREATE POLICY "Client portal users can view their metrics"
ON public.post_metrics
FOR SELECT
USING (
  (post_id IN (
    SELECT p.id FROM posts p
    WHERE p.client_id IN (
      SELECT client_id FROM client_portal_users WHERE user_id = auth.uid()
    )
  ))
  OR
  (asset_id IN (
    SELECT a.id FROM assets a
    WHERE a.client_id IN (
      SELECT client_id FROM client_portal_users WHERE user_id = auth.uid()
    )
  ))
);

-- Create function to validate pipeline stage transitions
CREATE OR REPLACE FUNCTION public.validate_stage_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  valid_transition BOOLEAN := FALSE;
BEGIN
  -- Allow all transitions if stage hasn't changed
  IF OLD.pipeline_stage = NEW.pipeline_stage THEN
    RETURN NEW;
  END IF;

  -- Define valid transitions
  valid_transition := (
    (OLD.pipeline_stage = 'raw' AND NEW.pipeline_stage = 'editing') OR
    (OLD.pipeline_stage = 'editing' AND NEW.pipeline_stage = 'approval') OR
    (OLD.pipeline_stage = 'approval' AND NEW.pipeline_stage = 'final') OR
    (OLD.pipeline_stage = 'approval' AND NEW.pipeline_stage = 'editing') OR -- Allow back to editing for changes
    (OLD.pipeline_stage = 'final' AND NEW.pipeline_stage = 'scheduled') OR
    (OLD.pipeline_stage = 'scheduled' AND NEW.pipeline_stage = 'published') OR
    -- Allow managers/owners to move back stages for corrections
    (is_agency_admin((SELECT c.agency_id FROM clients c JOIN assets a ON a.client_id = c.id WHERE a.id = NEW.id), auth.uid()))
  );

  IF NOT valid_transition THEN
    RAISE EXCEPTION 'Invalid pipeline stage transition from % to %', OLD.pipeline_stage, NEW.pipeline_stage;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for stage transition validation
DROP TRIGGER IF EXISTS validate_pipeline_stage_transition ON public.assets;
CREATE TRIGGER validate_pipeline_stage_transition
BEFORE UPDATE OF pipeline_stage ON public.assets
FOR EACH ROW
EXECUTE FUNCTION public.validate_stage_transition();

-- Create function to transition pipeline stages
CREATE OR REPLACE FUNCTION public.transition_pipeline_stage(
  _asset_id UUID,
  _new_stage public.pipeline_stage
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asset RECORD;
  v_agency_id UUID;
  v_result JSONB;
BEGIN
  -- Get asset and verify permissions
  SELECT a.*, c.agency_id INTO v_asset
  FROM assets a
  JOIN clients c ON a.client_id = c.id
  WHERE a.id = _asset_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Asset not found'
    );
  END IF;

  v_agency_id := v_asset.agency_id;

  -- Verify user has permission
  IF NOT EXISTS (
    SELECT 1 FROM agency_members
    WHERE agency_id = v_agency_id
      AND user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Unauthorized'
    );
  END IF;

  -- Update pipeline stage
  UPDATE assets
  SET pipeline_stage = _new_stage,
      updated_at = now()
  WHERE id = _asset_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'asset_id', _asset_id,
    'old_stage', v_asset.pipeline_stage,
    'new_stage', _new_stage
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', SQLERRM
    );
END;
$$;

-- Create trigger to auto-update updated_at on approval_tasks
CREATE TRIGGER update_approval_tasks_updated_at
BEFORE UPDATE ON public.approval_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to auto-update updated_at on post_metrics
CREATE TRIGGER update_post_metrics_updated_at
BEFORE UPDATE ON public.post_metrics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments for documentation
COMMENT ON TYPE public.pipeline_stage IS 'Content pipeline stages: raw → editing → approval → final → scheduled → published';
COMMENT ON TYPE public.approval_status IS 'Approval task statuses: pending, approved, changes_requested';
COMMENT ON TABLE public.approval_tasks IS 'Tracks approval workflow for asset versions with client/stakeholder feedback';
COMMENT ON TABLE public.post_metrics IS 'Stores engagement metrics (views, likes, comments, shares) for published posts';
COMMENT ON FUNCTION public.transition_pipeline_stage IS 'Safely transitions an asset through pipeline stages with validation and permission checks';
COMMENT ON FUNCTION public.validate_stage_transition IS 'Trigger function that enforces valid pipeline stage transitions';
