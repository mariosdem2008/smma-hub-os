-- Add new columns to projects table for 8-stage pipeline workflow
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.agency_members(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS last_moved_by uuid,
ADD COLUMN IF NOT EXISTS last_moved_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS latest_activity_id uuid REFERENCES public.project_activities(id) ON DELETE SET NULL;

-- Create index for assigned_to for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_assigned_to ON public.projects(assigned_to);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);

-- Update existing projects to have consistent status values
-- Map old statuses to new 8-stage statuses
UPDATE public.projects SET status = 'idea' WHERE status IS NULL OR status = '';
UPDATE public.projects SET status = 'script_copy' WHERE status = 'scripting';
UPDATE public.projects SET status = 'editing' WHERE status = 'production';

-- Create function to sync status and pipeline_stage
CREATE OR REPLACE FUNCTION public.sync_project_status_pipeline_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- If status changed, update pipeline_stage to match
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.pipeline_stage = NEW.status;
    NEW.last_moved_at = now();
  END IF;
  
  -- If pipeline_stage changed directly, update status to match
  IF NEW.pipeline_stage IS DISTINCT FROM OLD.pipeline_stage AND NEW.status = OLD.status THEN
    NEW.status = NEW.pipeline_stage;
    NEW.last_moved_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for status/pipeline_stage sync
DROP TRIGGER IF EXISTS sync_project_status_trigger ON public.projects;
CREATE TRIGGER sync_project_status_trigger
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_project_status_pipeline_stage();

-- Create function to log project stage transitions
CREATE OR REPLACE FUNCTION public.log_project_stage_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity_id uuid;
  v_actor_id uuid;
  v_actor_type text;
BEGIN
  -- Only log if status actually changed
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Determine actor (use last_moved_by if set, otherwise try auth.uid())
    v_actor_id := COALESCE(NEW.last_moved_by, auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
    
    -- Determine actor type
    IF EXISTS (SELECT 1 FROM public.agency_members WHERE user_id = v_actor_id AND agency_id = NEW.agency_id) THEN
      v_actor_type := 'agency';
    ELSIF EXISTS (SELECT 1 FROM public.client_users WHERE id = v_actor_id AND client_id = NEW.client_id) THEN
      v_actor_type := 'client';
    ELSE
      v_actor_type := 'system';
    END IF;
    
    -- Insert activity log
    INSERT INTO public.project_activities (
      project_id,
      agency_id,
      client_id,
      actor_id,
      actor_type,
      action,
      payload
    ) VALUES (
      NEW.id,
      NEW.agency_id,
      NEW.client_id,
      v_actor_id,
      v_actor_type,
      'status_changed',
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'rejection_reason', NEW.rejection_reason
      )
    )
    RETURNING id INTO v_activity_id;
    
    -- Update latest_activity_id on the project
    NEW.latest_activity_id := v_activity_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for logging stage transitions
DROP TRIGGER IF EXISTS log_project_stage_transition_trigger ON public.projects;
CREATE TRIGGER log_project_stage_transition_trigger
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.log_project_stage_transition();