-- Add review_comment column to posts table
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS review_comment TEXT,
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- Add review_comment column to ideas table
ALTER TABLE public.ideas 
ADD COLUMN IF NOT EXISTS review_comment TEXT,
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- Update posts status to use proper workflow values
-- Note: existing posts with 'draft' status will remain, new ones will use 'draft' as default
ALTER TABLE public.posts 
ALTER COLUMN status SET DEFAULT 'draft';

-- Update ideas status to support approval workflow
-- Note: existing ideas statuses are preserved ('idea', 'approved', 'rejected', 'used')
ALTER TABLE public.ideas 
ALTER COLUMN status SET DEFAULT 'draft';

-- Create activity log table for tracking approval workflow
CREATE TABLE IF NOT EXISTS public.content_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'idea')),
  content_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'submitted', 'approved', 'rejected')),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on activities
ALTER TABLE public.content_activities ENABLE ROW LEVEL SECURITY;

-- Agency members can view activities
CREATE POLICY "Agency members can view activities"
ON public.content_activities
FOR SELECT
USING (
  client_id IN (
    SELECT c.id FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

-- Agency members can create activities
CREATE POLICY "Agency members can create activities"
ON public.content_activities
FOR INSERT
WITH CHECK (
  client_id IN (
    SELECT c.id FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
  AND actor_id = auth.uid()
);

-- Client portal users can view activities for their client
CREATE POLICY "Client portal users can view activities"
ON public.content_activities
FOR SELECT
USING (
  client_id IN (
    SELECT client_id FROM client_portal_users
    WHERE user_id = auth.uid()
  )
);

-- Client portal users can create activities for their client
CREATE POLICY "Client portal users can create activities"
ON public.content_activities
FOR INSERT
WITH CHECK (
  client_id IN (
    SELECT client_id FROM client_portal_users
    WHERE user_id = auth.uid()
  )
  AND actor_id = auth.uid()
);

-- Create function to log activity on status change
CREATE OR REPLACE FUNCTION log_content_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log if status changed
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) OR TG_OP = 'INSERT' THEN
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
        WHEN NEW.status = 'draft' THEN 'created'
        WHEN NEW.status = 'in_review' THEN 'submitted'
        WHEN NEW.status = 'approved' THEN 'approved'
        WHEN NEW.status = 'rejected' THEN 'rejected'
        ELSE 'created'
      END,
      auth.uid(),
      NEW.review_comment
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Add triggers for posts
DROP TRIGGER IF EXISTS log_post_activity ON public.posts;
CREATE TRIGGER log_post_activity
AFTER INSERT OR UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION log_content_activity('post');

-- Add triggers for ideas
DROP TRIGGER IF EXISTS log_idea_activity ON public.ideas;
CREATE TRIGGER log_idea_activity
AFTER INSERT OR UPDATE ON public.ideas
FOR EACH ROW
EXECUTE FUNCTION log_content_activity('idea');

-- Enable realtime for posts
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;

-- Enable realtime for ideas
ALTER PUBLICATION supabase_realtime ADD TABLE public.ideas;

-- Enable realtime for activities
ALTER PUBLICATION supabase_realtime ADD TABLE public.content_activities;