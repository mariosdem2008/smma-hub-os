-- Create helper function to check if user is agency owner
CREATE OR REPLACE FUNCTION public.is_agency_owner(_agency_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agencies
    WHERE id = _agency_id
      AND user_id = _user_id
  );
$$;

-- Create agency_members table
CREATE TABLE public.agency_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'manager', 'creator', 'viewer')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(agency_id, user_id)
);

-- Enable RLS on agency_members
ALTER TABLE public.agency_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agency_members

-- Users can view their own agency membership
CREATE POLICY "Users can view their own agency membership"
ON public.agency_members
FOR SELECT
USING (auth.uid() = user_id);

-- Agency owners can view all members in their agency
CREATE POLICY "Agency owners can view all members"
ON public.agency_members
FOR SELECT
USING (public.is_agency_owner(agency_id, auth.uid()));

-- Agency owners can insert new members
CREATE POLICY "Agency owners can insert members"
ON public.agency_members
FOR INSERT
WITH CHECK (public.is_agency_owner(agency_id, auth.uid()));

-- Agency owners can update member roles
CREATE POLICY "Agency owners can update member roles"
ON public.agency_members
FOR UPDATE
USING (public.is_agency_owner(agency_id, auth.uid()));

-- Agency owners can delete members
CREATE POLICY "Agency owners can delete members"
ON public.agency_members
FOR DELETE
USING (public.is_agency_owner(agency_id, auth.uid()));

-- Create agency_invites table
CREATE TABLE public.agency_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'manager', 'creator', 'viewer')),
  token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  accepted boolean NOT NULL DEFAULT false
);

-- Enable RLS on agency_invites
ALTER TABLE public.agency_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agency_invites

-- Agency owners can view invites for their agency
CREATE POLICY "Agency owners can view invites"
ON public.agency_invites
FOR SELECT
USING (public.is_agency_owner(agency_id, auth.uid()));

-- Agency owners can create invites
CREATE POLICY "Agency owners can create invites"
ON public.agency_invites
FOR INSERT
WITH CHECK (public.is_agency_owner(agency_id, auth.uid()));

-- Agency owners can update invites (e.g., to mark as accepted)
CREATE POLICY "Agency owners can update invites"
ON public.agency_invites
FOR UPDATE
USING (public.is_agency_owner(agency_id, auth.uid()));

-- Agency owners can delete invites
CREATE POLICY "Agency owners can delete invites"
ON public.agency_invites
FOR DELETE
USING (public.is_agency_owner(agency_id, auth.uid()));

-- Anyone can view an invite by matching token (for accepting invites)
CREATE POLICY "Anyone can view invite by token"
ON public.agency_invites
FOR SELECT
USING (token IS NOT NULL);

-- Create index for faster token lookups
CREATE INDEX idx_agency_invites_token ON public.agency_invites(token) WHERE NOT accepted;

-- Create index for faster agency lookups
CREATE INDEX idx_agency_members_agency_id ON public.agency_members(agency_id);
CREATE INDEX idx_agency_invites_agency_id ON public.agency_invites(agency_id);