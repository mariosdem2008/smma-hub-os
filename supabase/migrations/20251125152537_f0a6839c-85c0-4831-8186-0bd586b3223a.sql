-- Function to create approval tasks when asset enters approval stage
CREATE OR REPLACE FUNCTION public.create_approval_tasks_for_asset()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_approver RECORD;
  v_latest_version_id UUID;
BEGIN
  -- Only proceed if transitioning TO approval stage
  IF NEW.pipeline_stage = 'approval' AND (OLD.pipeline_stage IS NULL OR OLD.pipeline_stage != 'approval') THEN
    
    -- Get the latest asset version for this asset
    SELECT id INTO v_latest_version_id
    FROM asset_versions
    WHERE asset_id = NEW.id
    ORDER BY version_number DESC
    LIMIT 1;
    
    -- If no version exists, create one
    IF v_latest_version_id IS NULL THEN
      INSERT INTO asset_versions (
        asset_id,
        agency_id,
        file_url,
        version_number,
        uploaded_by,
        file_size
      )
      SELECT 
        NEW.id,
        c.agency_id,
        NEW.file_url,
        1,
        NEW.uploaded_by,
        NEW.file_size
      FROM clients c
      WHERE c.id = NEW.client_id
      RETURNING id INTO v_latest_version_id;
    END IF;
    
    -- Get the first approver in the workflow
    SELECT 
      caw.approver_id,
      caw.role_name,
      caw.approver_order
    INTO v_first_approver
    FROM client_approval_workflows caw
    WHERE caw.client_id = NEW.client_id
    ORDER BY caw.approver_order ASC
    LIMIT 1;
    
    -- Create approval task for the first approver
    IF v_first_approver.approver_id IS NOT NULL THEN
      INSERT INTO approval_tasks (
        asset_version_id,
        approver_id,
        status,
        comments
      ) VALUES (
        v_latest_version_id,
        v_first_approver.approver_id,
        'pending',
        '[]'::jsonb
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic approval task creation
DROP TRIGGER IF EXISTS trigger_create_approval_tasks ON assets;
CREATE TRIGGER trigger_create_approval_tasks
  AFTER INSERT OR UPDATE OF pipeline_stage ON assets
  FOR EACH ROW
  EXECUTE FUNCTION public.create_approval_tasks_for_asset();

-- Function to handle approval task status changes and create next approver task
CREATE OR REPLACE FUNCTION public.handle_approval_task_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asset_id UUID;
  v_client_id UUID;
  v_current_order INTEGER;
  v_next_approver RECORD;
BEGIN
  -- Only proceed if status changed to approved or changes_requested
  IF NEW.status != OLD.status THEN
    
    -- Get asset and client info
    SELECT av.asset_id, a.client_id INTO v_asset_id, v_client_id
    FROM asset_versions av
    JOIN assets a ON av.asset_id = a.id
    WHERE av.id = NEW.asset_version_id;
    
    IF NEW.status = 'approved' THEN
      -- Get current approver's order
      SELECT caw.approver_order INTO v_current_order
      FROM client_approval_workflows caw
      WHERE caw.client_id = v_client_id
        AND caw.approver_id = NEW.approver_id;
      
      -- Check if there's a next approver
      SELECT 
        caw.approver_id,
        caw.role_name,
        caw.approver_order
      INTO v_next_approver
      FROM client_approval_workflows caw
      WHERE caw.client_id = v_client_id
        AND caw.approver_order > v_current_order
      ORDER BY caw.approver_order ASC
      LIMIT 1;
      
      IF v_next_approver.approver_id IS NOT NULL THEN
        -- Create approval task for next approver
        INSERT INTO approval_tasks (
          asset_version_id,
          approver_id,
          status,
          comments
        ) VALUES (
          NEW.asset_version_id,
          v_next_approver.approver_id,
          'pending',
          '[]'::jsonb
        );
      ELSE
        -- No more approvers, move to final stage
        UPDATE assets
        SET pipeline_stage = 'final',
            updated_at = NOW()
        WHERE id = v_asset_id;
      END IF;
      
    ELSIF NEW.status = 'changes_requested' THEN
      -- Move asset back to editing stage
      UPDATE assets
      SET pipeline_stage = 'editing',
          updated_at = NOW()
      WHERE id = v_asset_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for approval task status changes
DROP TRIGGER IF EXISTS trigger_handle_approval_task_update ON approval_tasks;
CREATE TRIGGER trigger_handle_approval_task_update
  AFTER UPDATE OF status ON approval_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_approval_task_update();