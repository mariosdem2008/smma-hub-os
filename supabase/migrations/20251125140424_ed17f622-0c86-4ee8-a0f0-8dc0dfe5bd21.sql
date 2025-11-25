-- Create secure function to link portal invitation to user after login
CREATE OR REPLACE FUNCTION public.accept_portal_invitation(_invitation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_email text;
  _invitation_email text;
BEGIN
  -- Get the authenticated user's email
  SELECT email INTO _user_email FROM auth.users WHERE id = auth.uid();
  
  IF _user_email IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get the invitation's email
  SELECT email INTO _invitation_email FROM client_portal_users WHERE id = _invitation_id;
  
  IF _invitation_email IS NULL THEN
    RETURN false;
  END IF;
  
  -- Validate email match (case-insensitive)
  IF LOWER(_user_email) != LOWER(_invitation_email) THEN
    RETURN false;
  END IF;
  
  -- Update the invitation to link the user
  UPDATE client_portal_users
  SET user_id = auth.uid(),
      accepted_at = NOW()
  WHERE id = _invitation_id
    AND user_id IS NULL;
  
  RETURN FOUND;
END;
$$;