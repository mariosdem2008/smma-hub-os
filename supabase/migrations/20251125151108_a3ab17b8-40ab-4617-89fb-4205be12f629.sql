-- Add RLS policies for client portal users to access approval tasks

-- Client users can view approval tasks assigned to them
CREATE POLICY "Client users can view their approval tasks"
ON approval_tasks
FOR SELECT
TO authenticated
USING (
  approver_id IN (
    SELECT id FROM client_users
    WHERE id = approver_id
  )
);

-- Client users can update approval tasks assigned to them
CREATE POLICY "Client users can update their approval tasks"
ON approval_tasks
FOR UPDATE
TO authenticated
USING (
  approver_id IN (
    SELECT id FROM client_users
    WHERE id = approver_id
  )
);

-- Client users can view asset versions for their client
CREATE POLICY "Client users can view asset versions"
ON asset_versions
FOR SELECT
TO authenticated
USING (
  asset_id IN (
    SELECT id FROM assets
    WHERE client_id IN (
      SELECT client_id FROM client_users
    )
  )
);

-- Client users can view assets for their client  
CREATE POLICY "Client users can view their client assets"
ON assets
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT client_id FROM client_users
  )
);

-- Client users can update assets (for metadata edits during approval)
CREATE POLICY "Client users can update asset metadata"
ON assets
FOR UPDATE
TO authenticated
USING (
  client_id IN (
    SELECT client_id FROM client_users
    WHERE role IN ('client', 'approver')
  )
);
