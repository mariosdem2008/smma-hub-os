-- Update RLS policy to allow inserting portal users without invitation check
DROP POLICY IF EXISTS "Agency members can create portal users" ON public.client_portal_users;

-- Allow any authenticated user to create their own portal access entry
CREATE POLICY "Users can create their own portal access"
ON public.client_portal_users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Update the policy description
COMMENT ON POLICY "Users can create their own portal access" ON public.client_portal_users 
IS 'Allows any authenticated user to create their own portal access entry when they have the portal link';