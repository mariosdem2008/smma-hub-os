-- Drop the previous policies that won't work with client portal auth
DROP POLICY IF EXISTS "Client users can view their approval tasks" ON approval_tasks;
DROP POLICY IF EXISTS "Client users can update their approval tasks" ON approval_tasks;
DROP POLICY IF EXISTS "Client users can view asset versions" ON asset_versions;
DROP POLICY IF EXISTS "Client users can view their client assets" ON assets;
DROP POLICY IF EXISTS "Client users can update asset metadata" ON assets;

-- Create more permissive policies for client portal access
-- These work with the client portal's custom JWT system

-- Allow viewing approval tasks (will be filtered by approver_id in application code)
CREATE POLICY "Public can view approval tasks"
ON approval_tasks
FOR SELECT
TO public
USING (true);

-- Allow updating approval tasks (application validates ownership)
CREATE POLICY "Public can update approval tasks"
ON approval_tasks  
FOR UPDATE
TO public
USING (true);

-- Asset versions already have agency member policies, add public read for client portal
CREATE POLICY "Public can view asset versions for approval"
ON asset_versions
FOR SELECT
TO public
USING (true);

-- Allow updating assets for metadata edits (application validates permissions)
CREATE POLICY "Public can update assets for approval"
ON assets
FOR UPDATE
TO public
USING (true);
