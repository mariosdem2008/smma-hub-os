-- Create client_branding table
CREATE TABLE public.client_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  primary_color TEXT,
  secondary_color TEXT,
  accent_color TEXT,
  brand_palette TEXT[],
  brand_voice TEXT,
  brand_tone TEXT,
  brand_guidelines TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create client_content_pillars table
CREATE TABLE public.client_content_pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create client_ideas table
CREATE TABLE public.client_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  tag TEXT,
  status TEXT DEFAULT 'idea',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create client_assets table
CREATE TABLE public.client_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create client_inspiration table
CREATE TABLE public.client_inspiration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  image_url TEXT,
  source_url TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create client_hashtags table
CREATE TABLE public.client_hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add trigger for updated_at on client_branding
CREATE TRIGGER update_client_branding_updated_at
  BEFORE UPDATE ON public.client_branding
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add status validation trigger for client_ideas
CREATE OR REPLACE FUNCTION validate_client_idea_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('idea', 'approved', 'rejected', 'used') THEN
    RAISE EXCEPTION 'Invalid status. Must be one of: idea, approved, rejected, used';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_client_ideas_status
  BEFORE INSERT OR UPDATE ON public.client_ideas
  FOR EACH ROW
  EXECUTE FUNCTION validate_client_idea_status();

-- Enable RLS
ALTER TABLE public.client_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_content_pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_inspiration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_hashtags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_branding
CREATE POLICY "Agency members can view client branding"
  ON public.client_branding FOR SELECT
  USING (client_id IN (SELECT c.id FROM public.clients c JOIN public.agency_members am ON c.agency_id = am.agency_id WHERE am.user_id = auth.uid()));

CREATE POLICY "Agency members can insert client branding"
  ON public.client_branding FOR INSERT
  WITH CHECK (client_id IN (SELECT c.id FROM public.clients c JOIN public.agency_members am ON c.agency_id = am.agency_id WHERE am.user_id = auth.uid()));

CREATE POLICY "Agency members can update client branding"
  ON public.client_branding FOR UPDATE
  USING (client_id IN (SELECT c.id FROM public.clients c JOIN public.agency_members am ON c.agency_id = am.agency_id WHERE am.user_id = auth.uid()));

CREATE POLICY "Agency members can delete client branding"
  ON public.client_branding FOR DELETE
  USING (client_id IN (SELECT c.id FROM public.clients c JOIN public.agency_members am ON c.agency_id = am.agency_id WHERE am.user_id = auth.uid()));

-- RLS Policies for client_content_pillars
CREATE POLICY "Agency members can view content pillars"
  ON public.client_content_pillars FOR SELECT
  USING (client_id IN (SELECT c.id FROM public.clients c JOIN public.agency_members am ON c.agency_id = am.agency_id WHERE am.user_id = auth.uid()));

CREATE POLICY "Agency members can insert content pillars"
  ON public.client_content_pillars FOR INSERT
  WITH CHECK (client_id IN (SELECT c.id FROM public.clients c JOIN public.agency_members am ON c.agency_id = am.agency_id WHERE am.user_id = auth.uid()));

CREATE POLICY "Agency members can update content pillars"
  ON public.client_content_pillars FOR UPDATE
  USING (client_id IN (SELECT c.id FROM public.clients c JOIN public.agency_members am ON c.agency_id = am.agency_id WHERE am.user_id = auth.uid()));

CREATE POLICY "Agency members can delete content pillars"
  ON public.client_content_pillars FOR DELETE
  USING (client_id IN (SELECT c.id FROM public.clients c JOIN public.agency_members am ON c.agency_id = am.agency_id WHERE am.user_id = auth.uid()));

-- RLS Policies for client_ideas
CREATE POLICY "Agency members can view client ideas"
  ON public.client_ideas FOR SELECT
  USING (client_id IN (SELECT c.id FROM public.clients c JOIN public.agency_members am ON c.agency_id = am.agency_id WHERE am.user_id = auth.uid()));

CREATE POLICY "Agency members can insert client ideas"
  ON public.client_ideas FOR INSERT
  WITH CHECK (client_id IN (SELECT c.id FROM public.clients c JOIN public.agency_members am ON c.agency_id = am.agency_id WHERE am.user_id = auth.uid()));

CREATE POLICY "Agency members can update client ideas"
  ON public.client_ideas FOR UPDATE
  USING (client_id IN (SELECT c.id FROM public.clients c JOIN public.agency_members am ON c.agency_id = am.agency_id WHERE am.user_id = auth.uid()));

CREATE POLICY "Agency members can delete client ideas"
  ON public.client_ideas FOR DELETE
  USING (client_id IN (SELECT c.id FROM public.clients c JOIN public.agency_members am ON c.agency_id = am.agency_id WHERE am.user_id = auth.uid()));

-- RLS Policies for client_assets
CREATE POLICY "Agency members can view client assets"
  ON public.client_assets FOR SELECT
  USING (client_id IN (SELECT c.id FROM public.clients c JOIN public.agency_members am ON c.agency_id = am.agency_id WHERE am.user_id = auth.uid()));

CREATE POLICY "Agency members can insert client assets"
  ON public.client_assets FOR INSERT
  WITH CHECK (client_id IN (SELECT c.id FROM public.clients c JOIN public.agency_members am ON c.agency_id = am.agency_id WHERE am.user_id = auth.uid()));

CREATE POLICY "Agency members can update client assets"
  ON public.client_assets FOR UPDATE
  USING (client_id IN (SELECT c.id FROM public.clients c JOIN public.agency_members am ON c.agency_id = am.agency_id WHERE am.user_id = auth.uid()));

CREATE POLICY "Agency members can delete client assets"
  ON public.client_assets FOR DELETE
  USING (client_id IN (SELECT c.id FROM public.clients c JOIN public.agency_members am ON c.agency_id = am.agency_id WHERE am.user_id = auth.uid()));

-- RLS Policies for client_inspiration
CREATE POLICY "Agency members can view client inspiration"
  ON public.client_inspiration FOR SELECT
  USING (client_id IN (SELECT c.id FROM public.clients c JOIN public.agency_members am ON c.agency_id = am.agency_id WHERE am.user_id = auth.uid()));

CREATE POLICY "Agency members can insert client inspiration"
  ON public.client_inspiration FOR INSERT
  WITH CHECK (client_id IN (SELECT c.id FROM public.clients c JOIN public.agency_members am ON c.agency_id = am.agency_id WHERE am.user_id = auth.uid()));

CREATE POLICY "Agency members can update client inspiration"
  ON public.client_inspiration FOR UPDATE
  USING (client_id IN (SELECT c.id FROM public.clients c JOIN public.agency_members am ON c.agency_id = am.agency_id WHERE am.user_id = auth.uid()));

CREATE POLICY "Agency members can delete client inspiration"
  ON public.client_inspiration FOR DELETE
  USING (client_id IN (SELECT c.id FROM public.clients c JOIN public.agency_members am ON c.agency_id = am.agency_id WHERE am.user_id = auth.uid()));

-- RLS Policies for client_hashtags
CREATE POLICY "Agency members can view client hashtags"
  ON public.client_hashtags FOR SELECT
  USING (client_id IN (SELECT c.id FROM public.clients c JOIN public.agency_members am ON c.agency_id = am.agency_id WHERE am.user_id = auth.uid()));

CREATE POLICY "Agency members can insert client hashtags"
  ON public.client_hashtags FOR INSERT
  WITH CHECK (client_id IN (SELECT c.id FROM public.clients c JOIN public.agency_members am ON c.agency_id = am.agency_id WHERE am.user_id = auth.uid()));

CREATE POLICY "Agency members can update client hashtags"
  ON public.client_hashtags FOR UPDATE
  USING (client_id IN (SELECT c.id FROM public.clients c JOIN public.agency_members am ON c.agency_id = am.agency_id WHERE am.user_id = auth.uid()));

CREATE POLICY "Agency members can delete client hashtags"
  ON public.client_hashtags FOR DELETE
  USING (client_id IN (SELECT c.id FROM public.clients c JOIN public.agency_members am ON c.agency_id = am.agency_id WHERE am.user_id = auth.uid()));