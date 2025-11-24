-- Drop the old client_ideas table completely
DROP TABLE IF EXISTS public.client_ideas CASCADE;

-- Ensure ideas table has correct structure with approval workflow
-- This is already created, but let's make sure it has the right columns
ALTER TABLE public.ideas 
ADD COLUMN IF NOT EXISTS review_comment TEXT,
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- Update ideas table to ensure status supports all workflow states
-- The status column should accept: draft, idea, in_review, approved, rejected, used
-- This is already flexible with TEXT type, so no change needed

-- Make sure RLS policies are correct for ideas table
-- Drop old policies that might conflict
DROP POLICY IF EXISTS "Agency members can view client ideas" ON public.ideas;
DROP POLICY IF EXISTS "Agency members can insert client ideas" ON public.ideas;
DROP POLICY IF EXISTS "Agency members can update client ideas" ON public.ideas;
DROP POLICY IF EXISTS "Agency members can delete client ideas" ON public.ideas;

-- Add comprehensive RLS policies for the approval workflow
-- Client portal users can create and view ideas
CREATE POLICY "Client portal users can create ideas"
ON public.ideas
FOR INSERT
WITH CHECK (
  client_id IN (
    SELECT client_id FROM client_portal_users
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Client portal users can view their client ideas"
ON public.ideas
FOR SELECT
USING (
  client_id IN (
    SELECT client_id FROM client_portal_users
    WHERE user_id = auth.uid()
  )
);

-- Client portal users can approve/reject ideas (update status)
CREATE POLICY "Client portal users can review ideas"
ON public.ideas
FOR UPDATE
USING (
  client_id IN (
    SELECT client_id FROM client_portal_users
    WHERE user_id = auth.uid()
  )
);

COMMENT ON TABLE public.ideas IS 'Content ideas with approval workflow. Supports statuses: draft, idea, in_review, approved, rejected, used';