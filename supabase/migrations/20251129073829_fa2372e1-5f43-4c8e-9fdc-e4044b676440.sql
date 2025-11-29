-- Add foreign key constraint for projects.final_asset_id
ALTER TABLE projects
ADD CONSTRAINT projects_final_asset_id_fkey
FOREIGN KEY (final_asset_id)
REFERENCES assets (id)
ON DELETE SET NULL;