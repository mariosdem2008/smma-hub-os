-- Fix infinite recursion by dropping and recreating policies correctly

-- Step 1: Drop ALL problematic policies
DROP POLICY IF EXISTS "Client portal users can view assigned client" ON public.clients;
DROP POLICY IF EXISTS "Users can view their own pending invitation" ON public.client_portal_users;
DROP POLICY IF EXISTS "Users can accept their email invitation" ON public.client_portal_users;
DROP POLICY IF EXISTS "Client portal users can view own record" ON public.client_portal_users;

-- Step 2: Re-add the secure client viewing policy using existing security definer function
CREATE POLICY "Client portal users can view their client"
ON public.clients
FOR SELECT
TO authenticated
USING (
  is_client_portal_user(id, auth.uid())
);

-- Step 3: Allow users to view their own portal access record
CREATE POLICY "Users can view own portal access"
ON public.client_portal_users
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Step 4: Allow users to accept invitations sent to their email
CREATE POLICY "Users can accept email invitations"
ON public.client_portal_users
FOR UPDATE
TO authenticated
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
  AND user_id IS NULL
)
WITH CHECK (
  user_id = auth.uid()
);