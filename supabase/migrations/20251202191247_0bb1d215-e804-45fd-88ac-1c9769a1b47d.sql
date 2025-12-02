-- Enforce agency owner and role change rules

-- 1) Trigger to enforce owner constraints: cannot demote/remove last owner or self-demote
CREATE OR REPLACE FUNCTION public.enforce_agency_owner_constraints()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE
  remaining_owners_count integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Prevent owners from demoting themselves
    IF OLD.role = 'owner' AND NEW.role <> 'owner' AND OLD.user_id = auth.uid() THEN
      RAISE EXCEPTION 'Owners cannot demote themselves';
    END IF;

    -- Prevent removing last owner role from agency_members
    IF OLD.role = 'owner' AND NEW.role <> 'owner' THEN
      SELECT COUNT(*) INTO remaining_owners_count
      FROM public.agency_members
      WHERE agency_id = OLD.agency_id
        AND role = 'owner'
        AND id <> OLD.id;

      IF remaining_owners_count = 0 THEN
        RAISE EXCEPTION 'Agency must have at least one owner';
      END IF;
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Prevent owners from deleting their own membership
    IF OLD.role = 'owner' AND OLD.user_id = auth.uid() THEN
      RAISE EXCEPTION 'Owners cannot remove themselves from the agency';
    END IF;

    -- Prevent deleting last owner
    IF OLD.role = 'owner' THEN
      SELECT COUNT(*) INTO remaining_owners_count
      FROM public.agency_members
      WHERE agency_id = OLD.agency_id
        AND role = 'owner'
        AND id <> OLD.id;

      IF remaining_owners_count = 0 THEN
        RAISE EXCEPTION 'Agency must have at least one owner';
      END IF;
    END IF;

    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach trigger to agency_members
DROP TRIGGER IF EXISTS trg_enforce_agency_owner_constraints ON public.agency_members;
CREATE TRIGGER trg_enforce_agency_owner_constraints
BEFORE UPDATE OR DELETE ON public.agency_members
FOR EACH ROW
EXECUTE FUNCTION public.enforce_agency_owner_constraints();


-- 2) Ensure multi-admin plan limit is enforced on inserts/role changes
DROP TRIGGER IF EXISTS trg_check_multi_admin_limit ON public.agency_members;
CREATE TRIGGER trg_check_multi_admin_limit
BEFORE INSERT OR UPDATE OF role ON public.agency_members
FOR EACH ROW
EXECUTE FUNCTION public.check_multi_admin_limit();


-- 3) Log role changes to notifications as audit trail
CREATE OR REPLACE FUNCTION public.log_agency_member_role_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE
  v_actor_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    v_actor_id := auth.uid();

    INSERT INTO public.notifications (
      agency_id,
      user_type,
      user_id,
      type,
      payload
    ) VALUES (
      NEW.agency_id,
      'agency_member',
      NEW.id::text,
      'role_updated',
      jsonb_build_object(
        'old_role', OLD.role,
        'new_role', NEW.role,
        'changed_by', v_actor_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_agency_member_role_change ON public.agency_members;
CREATE TRIGGER trg_log_agency_member_role_change
AFTER UPDATE OF role ON public.agency_members
FOR EACH ROW
EXECUTE FUNCTION public.log_agency_member_role_change();
