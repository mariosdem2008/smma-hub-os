-- Create function to safely delete a project and its orphaned assets
-- This function deletes a project and only deletes assets that:
-- 1. Are not linked to any other projects
-- 2. Are not marked as library assets (have no project_assets entries after deletion)
CREATE OR REPLACE FUNCTION delete_project_cascade(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asset_id uuid;
BEGIN
  -- Store asset IDs that are linked to this project
  CREATE TEMP TABLE temp_project_asset_ids AS
  SELECT asset_id FROM project_assets WHERE project_id = p_project_id;
  
  -- Delete project_assets entries for this project
  DELETE FROM project_assets WHERE project_id = p_project_id;
  
  -- Delete the project itself (will null out final_asset_id due to SET NULL constraint)
  DELETE FROM projects WHERE id = p_project_id;
  
  -- Delete assets that are now orphaned (not linked to any other project)
  FOR v_asset_id IN 
    SELECT asset_id FROM temp_project_asset_ids
  LOOP
    -- Check if this asset is still linked to any other project
    IF NOT EXISTS (
      SELECT 1 FROM project_assets WHERE asset_id = v_asset_id
    ) THEN
      -- Delete the orphaned asset
      DELETE FROM assets WHERE id = v_asset_id;
    END IF;
  END LOOP;
  
  -- Clean up temp table
  DROP TABLE IF EXISTS temp_project_asset_ids;
END;
$$;