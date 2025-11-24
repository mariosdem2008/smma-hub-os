-- Fix client portal invitation RLS policies

-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Users can create their own portal access" ON public.client_portal_users;

-- Create new INSERT policy for agency members creating invitations
CREATE POLICY "Agency members can create portal invitations"
ON public.client_portal_users
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow if agency member has access to this client
  client_id IN (
    SELECT c.id
    FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

-- Allow agency members to update portal invitations for their clients
CREATE POLICY "Agency members can update portal invitations"
ON public.client_portal_users
FOR UPDATE
TO authenticated
USING (
  client_id IN (
    SELECT c.id
    FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
)
WITH CHECK (
  client_id IN (
    SELECT c.id
    FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);