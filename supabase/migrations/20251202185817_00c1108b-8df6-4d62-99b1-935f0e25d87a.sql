-- 1) Indexes on notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON public.notifications (user_type, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_project
  ON public.notifications (project_id);

CREATE INDEX IF NOT EXISTS idx_notifications_conversation
  ON public.notifications (conversation_id);


-- 2) Extend notification_preferences with new flags
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS allow_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_in_app boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_mentions boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_approval_reminders boolean NOT NULL DEFAULT true;


-- 3) Trigger function: client approved notifications
CREATE OR REPLACE FUNCTION public.notify_project_client_approved()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_client_name text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'approved'
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN

    SELECT name INTO v_client_name
    FROM clients
    WHERE id = NEW.client_id;

    INSERT INTO notifications (agency_id, user_type, user_id, type, project_id, payload)
    SELECT NEW.agency_id,
           'agency_member',
           am.id,
           'client_approved',
           NEW.id,
           jsonb_build_object(
             'project_title', NEW.title,
             'client_name', v_client_name
           )
    FROM agency_members am
    WHERE am.agency_id = NEW.agency_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_project_client_approved ON public.projects;
CREATE TRIGGER tr_notify_project_client_approved
AFTER UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.notify_project_client_approved();


-- 4) Trigger function: client rejected notifications
CREATE OR REPLACE FUNCTION public.notify_project_client_rejected()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_client_name text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND OLD.status = 'client_review'
     AND NEW.rejection_reason IS NOT NULL THEN

    SELECT name INTO v_client_name
    FROM clients
    WHERE id = NEW.client_id;

    INSERT INTO notifications (agency_id, user_type, user_id, type, project_id, payload)
    SELECT NEW.agency_id,
           'agency_member',
           am.id,
           'client_rejected',
           NEW.id,
           jsonb_build_object(
             'project_title', NEW.title,
             'client_name', v_client_name,
             'rejection_reason', NEW.rejection_reason
           )
    FROM agency_members am
    WHERE am.agency_id = NEW.agency_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_project_client_rejected ON public.projects;
CREATE TRIGGER tr_notify_project_client_rejected
AFTER UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.notify_project_client_rejected();


-- 5) Trigger function: final asset uploaded notifications
CREATE OR REPLACE FUNCTION public.notify_final_asset_uploaded()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_project   projects%ROWTYPE;
  v_client_name text;
BEGIN
  IF TG_OP = 'INSERT'
     AND NEW.is_final_content = true THEN

    SELECT * INTO v_project
    FROM projects
    WHERE id = NEW.project_id;

    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    SELECT name INTO v_client_name
    FROM clients
    WHERE id = v_project.client_id;

    INSERT INTO notifications (agency_id, user_type, user_id, type, project_id, payload)
    SELECT v_project.agency_id,
           'agency_member',
           am.id,
           'final_asset_uploaded',
           v_project.id,
           jsonb_build_object(
             'project_title', v_project.title,
             'client_name', v_client_name
           )
    FROM agency_members am
    WHERE am.agency_id = v_project.agency_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_final_asset_uploaded ON public.project_assets;
CREATE TRIGGER tr_notify_final_asset_uploaded
AFTER INSERT ON public.project_assets
FOR EACH ROW
EXECUTE FUNCTION public.notify_final_asset_uploaded();
