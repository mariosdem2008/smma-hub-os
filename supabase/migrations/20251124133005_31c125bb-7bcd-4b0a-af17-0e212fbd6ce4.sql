-- =====================================================
-- CONTENT APPROVAL PIPELINE: DATABASE SCHEMA FIX
-- =====================================================
-- This migration aligns the database with the required workflow:
-- draft → in_review → approved/rejected

-- 1. Temporarily drop triggers to allow data migration
DROP TRIGGER IF EXISTS log_idea_activity ON public.ideas;
DROP TRIGGER IF EXISTS log_post_activity ON public.posts;

-- 2. Drop existing status constraints
ALTER TABLE public.ideas DROP CONSTRAINT IF EXISTS validate_client_idea_status;
ALTER TABLE public.ideas DROP CONSTRAINT IF EXISTS ideas_status_check;
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_status_check;

-- 3. Update existing ideas data to new status values
UPDATE public.ideas 
SET status = 'draft' 
WHERE status = 'idea' OR status NOT IN ('draft', 'in_review', 'approved', 'rejected');

-- 4. Update existing posts data to new status values
UPDATE public.posts 
SET status = 'draft' 
WHERE status NOT IN ('draft', 'in_review', 'approved', 'rejected');

-- 5. Add new status constraints
ALTER TABLE public.ideas 
ADD CONSTRAINT ideas_status_check 
CHECK (status IN ('draft', 'in_review', 'approved', 'rejected'));

ALTER TABLE public.posts 
ADD CONSTRAINT posts_status_check 
CHECK (status IN ('draft', 'in_review', 'approved', 'rejected'));

-- 6. Update the log_content_activity trigger function with better actor_id handling
CREATE OR REPLACE FUNCTION public.log_content_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_id uuid;
BEGIN
  -- Only log if status changed or new record
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) OR TG_OP = 'INSERT' THEN
    -- Determine actor_id: use auth.uid() if available, otherwise reviewed_by, otherwise use a system UUID
    v_actor_id := COALESCE(auth.uid(), NEW.reviewed_by, '00000000-0000-0000-0000-000000000000'::uuid);
    
    INSERT INTO public.content_activities (
      content_type,
      content_id,
      client_id,
      action,
      actor_id,
      comment
    ) VALUES (
      TG_ARGV[0], -- 'post' or 'idea'
      NEW.id,
      NEW.client_id,
      CASE 
        WHEN TG_OP = 'INSERT' OR NEW.status = 'draft' THEN 'created'
        WHEN NEW.status = 'in_review' THEN 'submitted'
        WHEN NEW.status = 'approved' THEN 'approved'
        WHEN NEW.status = 'rejected' THEN 'rejected'
        ELSE 'updated'
      END,
      v_actor_id,
      NEW.review_comment
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- 7. Recreate triggers
CREATE TRIGGER log_idea_activity
  AFTER INSERT OR UPDATE ON public.ideas
  FOR EACH ROW
  EXECUTE FUNCTION public.log_content_activity('idea');

CREATE TRIGGER log_post_activity
  AFTER INSERT OR UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.log_content_activity('post');

-- =====================================================
-- CLEANUP REDUNDANT RLS POLICIES
-- =====================================================

-- Drop redundant user policies for ideas
DROP POLICY IF EXISTS "Users can delete ideas from their agency" ON public.ideas;
DROP POLICY IF EXISTS "Users can insert ideas for their agency" ON public.ideas;
DROP POLICY IF EXISTS "Users can update ideas from their agency" ON public.ideas;
DROP POLICY IF EXISTS "Users can view ideas from their agency" ON public.ideas;

-- Drop redundant user policies for posts
DROP POLICY IF EXISTS "Users can delete posts from their agency" ON public.posts;
DROP POLICY IF EXISTS "Users can insert posts for their agency" ON public.posts;
DROP POLICY IF EXISTS "Users can update posts from their agency" ON public.posts;
DROP POLICY IF EXISTS "Users can view posts from their agency" ON public.posts;