-- Fix search_path for validate_client_idea_status function
CREATE OR REPLACE FUNCTION validate_client_idea_status()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('idea', 'approved', 'rejected', 'used') THEN
    RAISE EXCEPTION 'Invalid status. Must be one of: idea, approved, rejected, used';
  END IF;
  RETURN NEW;
END;
$$;