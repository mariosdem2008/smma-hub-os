-- Create post_comments table
CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- Agency members can view comments for their agency's posts
CREATE POLICY "Agency members can view comments"
  ON public.post_comments
  FOR SELECT
  USING (
    agency_id IN (
      SELECT am.agency_id FROM agency_members am
      WHERE am.user_id = auth.uid()
    )
  );

-- Agency members can insert comments for their agency's posts
CREATE POLICY "Agency members can insert comments"
  ON public.post_comments
  FOR INSERT
  WITH CHECK (
    agency_id IN (
      SELECT am.agency_id FROM agency_members am
      WHERE am.user_id = auth.uid()
    ) AND author_id = auth.uid()
  );

-- Agency members can update their own comments
CREATE POLICY "Agency members can update own comments"
  ON public.post_comments
  FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Agency members can delete their own comments
CREATE POLICY "Agency members can delete own comments"
  ON public.post_comments
  FOR DELETE
  USING (author_id = auth.uid());

-- Client portal users can view comments for their client's posts
CREATE POLICY "Client portal users can view comments"
  ON public.post_comments
  FOR SELECT
  USING (
    post_id IN (
      SELECT p.id FROM posts p
      JOIN client_portal_users cpu ON p.client_id = cpu.client_id
      WHERE cpu.user_id = auth.uid()
    )
  );

-- Client portal users can insert comments for their client's posts
CREATE POLICY "Client portal users can insert comments"
  ON public.post_comments
  FOR INSERT
  WITH CHECK (
    post_id IN (
      SELECT p.id FROM posts p
      JOIN client_portal_users cpu ON p.client_id = cpu.client_id
      WHERE cpu.user_id = auth.uid()
    ) AND author_id = auth.uid()
  );

-- Client portal users can update their own comments
CREATE POLICY "Client portal users can update own comments"
  ON public.post_comments
  FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Client portal users can delete their own comments
CREATE POLICY "Client portal users can delete own comments"
  ON public.post_comments
  FOR DELETE
  USING (author_id = auth.uid());

-- Add updated_at trigger
CREATE TRIGGER update_post_comments_updated_at
  BEFORE UPDATE ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_post_comments_post_id ON public.post_comments(post_id);
CREATE INDEX idx_post_comments_parent_id ON public.post_comments(parent_id);
CREATE INDEX idx_post_comments_author_id ON public.post_comments(author_id);
CREATE INDEX idx_post_comments_agency_id ON public.post_comments(agency_id);

-- Enable realtime for post_comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;