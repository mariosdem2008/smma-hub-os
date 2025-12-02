-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_type text NOT NULL CHECK (user_type IN ('agency_member', 'client_user')),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('new_message', 'failed_post', 'approval_reminder')),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
-- Agency members can see their own notifications
CREATE POLICY "Agency members can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (
    user_type = 'agency_member' 
    AND user_id IN (
      SELECT am.id FROM public.agency_members am WHERE am.user_id = auth.uid()
    )
  );

-- Agency members can update (mark as read) their own notifications
CREATE POLICY "Agency members can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (
    user_type = 'agency_member' 
    AND user_id IN (
      SELECT am.id FROM public.agency_members am WHERE am.user_id = auth.uid()
    )
  );

-- Client users can view their own notifications
CREATE POLICY "Client users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (
    user_type = 'client_user' 
    AND user_id = auth.uid()
  );

-- Client users can update their own notifications
CREATE POLICY "Client users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (
    user_type = 'client_user' 
    AND user_id = auth.uid()
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_type, user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);
