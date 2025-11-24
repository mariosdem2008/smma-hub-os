-- Add audit trail columns to agency_members
ALTER TABLE public.agency_members
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;

-- Add unique constraint to prevent duplicate pending invites
CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_invites_unique_pending 
ON public.agency_invites (agency_id, email)
WHERE accepted = FALSE;

-- Create secure function to accept invites (bypasses RLS)
CREATE OR REPLACE FUNCTION public.accept_agency_invite(
  _invite_token TEXT,
  _user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
BEGIN
  -- Get and validate invite
  SELECT * INTO v_invite
  FROM public.agency_invites
  WHERE token = _invite_token
    AND accepted = FALSE
    AND expires_at > NOW();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Invalid or expired invite'
    );
  END IF;
  
  -- Check if user is already a member
  IF EXISTS (
    SELECT 1 FROM public.agency_members
    WHERE agency_id = v_invite.agency_id
      AND user_id = _user_id
  ) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'User is already a member of this agency'
    );
  END IF;
  
  -- Insert into agency_members with audit trail
  INSERT INTO public.agency_members (agency_id, user_id, role, accepted_at)
  VALUES (v_invite.agency_id, _user_id, v_invite.role, NOW());
  
  -- Mark invite as accepted
  UPDATE public.agency_invites
  SET accepted = TRUE
  WHERE id = v_invite.id;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'agency_id', v_invite.agency_id
  );
END;
$$;