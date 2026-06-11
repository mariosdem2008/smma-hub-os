-- Fix: the "Agency must have at least one owner" guard fires on the cascade
-- delete of agency_members when an agency itself is deleted, making agencies
-- permanently undeletable (legitimate offboarding / GDPR erasure impossible).
-- The owner-count and self-removal checks should only apply while the parent
-- agency still exists. During an agency cascade delete, the agency row is gone,
-- so we skip enforcement and allow the membership rows to cascade out.

CREATE OR REPLACE FUNCTION public.enforce_agency_owner_constraints()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE
  remaining_owners_count integer;
  agency_still_exists boolean;
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
    -- If the parent agency is being deleted, this DELETE is a cascade; do not
    -- enforce membership constraints that would block agency deletion.
    SELECT EXISTS (SELECT 1 FROM public.agencies WHERE id = OLD.agency_id)
    INTO agency_still_exists;

    IF NOT agency_still_exists THEN
      RETURN OLD;
    END IF;

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
