-- Update pipeline_stage enum to match new stages

-- Drop trigger and functions that depend on pipeline_stage
DROP TRIGGER IF EXISTS validate_pipeline_stage_transition ON assets;
DROP FUNCTION IF EXISTS transition_pipeline_stage(uuid, pipeline_stage);
DROP FUNCTION IF EXISTS validate_stage_transition();

-- Drop default constraint
ALTER TABLE assets ALTER COLUMN pipeline_stage DROP DEFAULT;

-- Rename old enum
ALTER TYPE pipeline_stage RENAME TO pipeline_stage_old;

-- Create new enum
CREATE TYPE pipeline_stage AS ENUM (
  'idea',
  'in_production',
  'review',
  'approved',
  'scheduled',
  'published'
);

-- Update assets table to use new enum with migration mapping
ALTER TABLE assets 
  ALTER COLUMN pipeline_stage TYPE pipeline_stage 
  USING (
    CASE pipeline_stage::text
      WHEN 'raw' THEN 'idea'::pipeline_stage
      WHEN 'editing' THEN 'in_production'::pipeline_stage
      WHEN 'approval' THEN 'review'::pipeline_stage
      WHEN 'final' THEN 'approved'::pipeline_stage
      WHEN 'scheduled' THEN 'scheduled'::pipeline_stage
      WHEN 'published' THEN 'published'::pipeline_stage
      ELSE 'idea'::pipeline_stage
    END
  );

-- Set new default
ALTER TABLE assets ALTER COLUMN pipeline_stage SET DEFAULT 'idea'::pipeline_stage;

-- Drop old enum (now safe since we dropped dependent functions)
DROP TYPE pipeline_stage_old;

-- Recreate validation function with new stages
CREATE OR REPLACE FUNCTION public.validate_stage_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  valid_transition BOOLEAN := FALSE;
BEGIN
  -- Allow all transitions if stage hasn't changed
  IF OLD.pipeline_stage = NEW.pipeline_stage THEN
    RETURN NEW;
  END IF;

  -- Define valid transitions for new pipeline
  valid_transition := (
    (OLD.pipeline_stage = 'idea' AND NEW.pipeline_stage = 'in_production') OR
    (OLD.pipeline_stage = 'in_production' AND NEW.pipeline_stage = 'review') OR
    (OLD.pipeline_stage = 'review' AND NEW.pipeline_stage = 'approved') OR
    (OLD.pipeline_stage = 'review' AND NEW.pipeline_stage = 'in_production') OR -- Allow back to production for changes
    (OLD.pipeline_stage = 'approved' AND NEW.pipeline_stage = 'scheduled') OR
    (OLD.pipeline_stage = 'scheduled' AND NEW.pipeline_stage = 'published') OR
    -- Allow managers/owners to move back stages for corrections
    (is_agency_admin((SELECT c.agency_id FROM clients c JOIN assets a ON a.client_id = c.id WHERE a.id = NEW.id), auth.uid()))
  );

  IF NOT valid_transition THEN
    RAISE EXCEPTION 'Invalid pipeline stage transition from % to %', OLD.pipeline_stage, NEW.pipeline_stage;
  END IF;

  RETURN NEW;
END;
$function$;

-- Recreate transition_pipeline_stage function with new enum
CREATE OR REPLACE FUNCTION public.transition_pipeline_stage(_asset_id uuid, _new_stage pipeline_stage)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

-- Recreate trigger
CREATE TRIGGER validate_pipeline_stage_transition
  BEFORE UPDATE ON assets
  FOR EACH ROW
  WHEN (OLD.pipeline_stage IS DISTINCT FROM NEW.pipeline_stage)
  EXECUTE FUNCTION validate_stage_transition();