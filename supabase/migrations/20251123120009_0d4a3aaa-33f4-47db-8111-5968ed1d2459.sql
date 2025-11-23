-- Add admin role support for Agency Plus multi-admin feature

-- First, let's update the check constraint on agency_members to allow 'admin' role
-- Drop the existing constraint if it exists
ALTER TABLE public.agency_members DROP CONSTRAINT IF EXISTS agency_members_role_check;

-- Add new constraint that includes 'admin' role
ALTER TABLE public.agency_members 
ADD CONSTRAINT agency_members_role_check 
CHECK (role IN ('owner', 'admin', 'manager', 'member'));

-- Create a function to check if a user is an admin or owner for an agency
CREATE OR REPLACE FUNCTION public.is_agency_admin(_agency_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agency_members
    WHERE agency_id = _agency_id
      AND user_id = _user_id
      AND role IN ('owner', 'admin')
  );
$$;

-- Update RLS policies to allow admins to perform admin actions

-- Drop existing owner-only policies and recreate with admin support
DROP POLICY IF EXISTS "Agency owners can delete members" ON public.agency_members;
DROP POLICY IF EXISTS "Agency owners can insert members" ON public.agency_members;
DROP POLICY IF EXISTS "Agency owners can update member roles" ON public.agency_members;
DROP POLICY IF EXISTS "Agency owners can view all members" ON public.agency_members;

-- Recreate policies with admin support
CREATE POLICY "Agency admins can view all members"
ON public.agency_members
FOR SELECT
TO authenticated
USING (is_agency_admin(agency_id, auth.uid()));

CREATE POLICY "Agency admins can insert members"
ON public.agency_members
FOR INSERT
TO authenticated
WITH CHECK (is_agency_admin(agency_id, auth.uid()));

CREATE POLICY "Agency admins can update member roles"
ON public.agency_members
FOR UPDATE
TO authenticated
USING (is_agency_admin(agency_id, auth.uid()));

CREATE POLICY "Agency admins can delete members"
ON public.agency_members
FOR DELETE
TO authenticated
USING (is_agency_admin(agency_id, auth.uid()));

-- Update agency_invites policies to allow admins
DROP POLICY IF EXISTS "Agency owners can create invites" ON public.agency_invites;
DROP POLICY IF EXISTS "Agency owners can delete invites" ON public.agency_invites;
DROP POLICY IF EXISTS "Agency owners can update invites" ON public.agency_invites;
DROP POLICY IF EXISTS "Agency owners can view invites" ON public.agency_invites;

CREATE POLICY "Agency admins can view invites"
ON public.agency_invites
FOR SELECT
TO authenticated
USING (is_agency_admin(agency_id, auth.uid()));

CREATE POLICY "Agency admins can create invites"
ON public.agency_invites
FOR INSERT
TO authenticated
WITH CHECK (is_agency_admin(agency_id, auth.uid()));

CREATE POLICY "Agency admins can update invites"
ON public.agency_invites
FOR UPDATE
TO authenticated
USING (is_agency_admin(agency_id, auth.uid()));

CREATE POLICY "Agency admins can delete invites"
ON public.agency_invites
FOR DELETE
TO authenticated
USING (is_agency_admin(agency_id, auth.uid()));

-- Add a trigger to prevent non-Agency Plus plans from having multiple admins
CREATE OR REPLACE FUNCTION public.check_multi_admin_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count INTEGER;
  agency_owner_id UUID;
  owner_plan_type TEXT;
BEGIN
  -- Only check if promoting to admin (not owner, since owner is always allowed)
  IF NEW.role = 'admin' THEN
    -- Count existing admins and owners (excluding this user)
    SELECT COUNT(*) INTO admin_count
    FROM public.agency_members
    WHERE agency_id = NEW.agency_id
      AND role IN ('owner', 'admin')
      AND user_id != NEW.user_id;
    
    -- If there's already an admin/owner, check plan
    IF admin_count > 0 THEN
      -- Get the agency owner's plan
      SELECT a.user_id INTO agency_owner_id
      FROM public.agencies a
      WHERE a.id = NEW.agency_id;
      
      SELECT s.plan_type INTO owner_plan_type
      FROM public.subscriptions s
      WHERE s.user_id = agency_owner_id;
      
      -- Only Agency Plus can have multiple admins
      IF owner_plan_type != 'agency_plus' THEN
        RAISE EXCEPTION 'Multi-admin feature requires Agency Plus plan';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_multi_admin_before_insert_or_update
BEFORE INSERT OR UPDATE ON public.agency_members
FOR EACH ROW
EXECUTE FUNCTION public.check_multi_admin_limit();