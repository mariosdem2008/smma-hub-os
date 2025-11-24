-- Step 1: Remove the dangerous public RLS policy
DROP POLICY IF EXISTS "Public can view enabled client portals" ON public.clients;

-- Step 2: Drop existing policy that will be recreated
DROP POLICY IF EXISTS "Client portal users can view assigned client" ON public.clients;

-- Step 3: Add invitation tracking columns to client_portal_users
ALTER TABLE public.client_portal_users
ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days');

-- Step 4: Add index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_client_portal_invite_token 
ON public.client_portal_users(invite_token) 
WHERE invite_token IS NOT NULL;

-- Step 5: Create secure token generation function
CREATE OR REPLACE FUNCTION public.generate_portal_invite_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$;

-- Step 6: Add secure RLS policy for client portal users
CREATE POLICY "Client portal users can view assigned client"
ON public.clients
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT client_id 
    FROM public.client_portal_users 
    WHERE user_id = auth.uid()
  )
);

-- Step 7: Update RLS policy for invitation acceptance
DROP POLICY IF EXISTS "Portal users can link their account on first login" ON public.client_portal_users;

CREATE POLICY "Users can accept their email invitation"
ON public.client_portal_users
FOR UPDATE
TO authenticated
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
  AND user_id IS NULL
  AND invite_token IS NOT NULL
)
WITH CHECK (
  user_id = auth.uid()
);

-- Step 8: Add policy for viewing pending invitations
CREATE POLICY "Users can view their own pending invitation"
ON public.client_portal_users
FOR SELECT
TO authenticated
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
  OR user_id = auth.uid()
);