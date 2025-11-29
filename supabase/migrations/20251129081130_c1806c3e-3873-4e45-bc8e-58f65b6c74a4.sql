-- Drop existing RLS policies on social_connections
DROP POLICY IF EXISTS "Agency members can view connections" ON public.social_connections;
DROP POLICY IF EXISTS "Agency members can create connections" ON public.social_connections;
DROP POLICY IF EXISTS "Agency members can update connections" ON public.social_connections;
DROP POLICY IF EXISTS "Agency members can delete connections" ON public.social_connections;

-- Create new role-aware RLS policies for social_connections
-- Agency owners and managers can manage all connections for their clients
CREATE POLICY "Agency owners and managers can view social connections"
ON public.social_connections
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT c.id FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
    AND am.role IN ('owner', 'admin', 'manager')
  )
  OR
  -- Client portal users can view only their own client's connections
  client_id IN (
    SELECT client_id FROM client_users
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Agency owners and managers can insert social connections"
ON public.social_connections
FOR INSERT
TO authenticated
WITH CHECK (
  client_id IN (
    SELECT c.id FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
    AND am.role IN ('owner', 'admin', 'manager')
  )
  OR
  -- Client portal users can insert connections for their own client
  client_id IN (
    SELECT client_id FROM client_users
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Agency owners and managers can update social connections"
ON public.social_connections
FOR UPDATE
TO authenticated
USING (
  client_id IN (
    SELECT c.id FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
    AND am.role IN ('owner', 'admin', 'manager')
  )
  OR
  -- Client portal users can update their own client's connections
  client_id IN (
    SELECT client_id FROM client_users
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Agency owners and managers can delete social connections"
ON public.social_connections
FOR DELETE
TO authenticated
USING (
  client_id IN (
    SELECT c.id FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
    AND am.role IN ('owner', 'admin', 'manager')
  )
  OR
  -- Client portal users can delete their own client's connections
  client_id IN (
    SELECT client_id FROM client_users
    WHERE id = auth.uid()
  )
);