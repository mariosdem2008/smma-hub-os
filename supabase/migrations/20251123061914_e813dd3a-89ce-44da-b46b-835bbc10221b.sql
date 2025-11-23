-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('owner', 'manager', 'client');

-- Create user_roles table (security-first approach)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can view all roles"
  ON public.user_roles
  FOR SELECT
  USING (public.has_role(auth.uid(), 'owner'));

-- Update clients table with brand information
ALTER TABLE public.clients
ADD COLUMN logo_url TEXT,
ADD COLUMN brand_colors JSONB DEFAULT '[]'::jsonb,
ADD COLUMN website TEXT,
ADD COLUMN instagram_url TEXT,
ADD COLUMN facebook_url TEXT,
ADD COLUMN tiktok_url TEXT,
ADD COLUMN linkedin_url TEXT,
ADD COLUMN youtube_url TEXT,
ADD COLUMN notes TEXT;

-- Create assets table
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id),
  is_client_upload BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assets for their clients"
  ON public.assets
  FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN agencies a ON c.agency_id = a.id
      WHERE a.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'client')
  );

CREATE POLICY "Users can create assets for their clients"
  ON public.assets
  FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN agencies a ON c.agency_id = a.id
      WHERE a.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'client')
  );

CREATE POLICY "Users can update assets for their clients"
  ON public.assets
  FOR UPDATE
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN agencies a ON c.agency_id = a.id
      WHERE a.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete assets for their clients"
  ON public.assets
  FOR DELETE
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN agencies a ON c.agency_id = a.id
      WHERE a.user_id = auth.uid()
    )
  );

-- Create ideas table
CREATE TABLE public.ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'idea' CHECK (status IN ('idea', 'draft', 'ready')),
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ideas for their clients"
  ON public.ideas
  FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN agencies a ON c.agency_id = a.id
      WHERE a.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'client')
  );

CREATE POLICY "Users can create ideas for their clients"
  ON public.ideas
  FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN agencies a ON c.agency_id = a.id
      WHERE a.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update ideas for their clients"
  ON public.ideas
  FOR UPDATE
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN agencies a ON c.agency_id = a.id
      WHERE a.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete ideas for their clients"
  ON public.ideas
  FOR DELETE
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN agencies a ON c.agency_id = a.id
      WHERE a.user_id = auth.uid()
    )
  );

-- Create captions table
CREATE TABLE public.captions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.captions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view captions for their clients"
  ON public.captions
  FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN agencies a ON c.agency_id = a.id
      WHERE a.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'client')
  );

CREATE POLICY "Users can create captions for their clients"
  ON public.captions
  FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN agencies a ON c.agency_id = a.id
      WHERE a.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update captions for their clients"
  ON public.captions
  FOR UPDATE
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN agencies a ON c.agency_id = a.id
      WHERE a.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete captions for their clients"
  ON public.captions
  FOR DELETE
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN agencies a ON c.agency_id = a.id
      WHERE a.user_id = auth.uid()
    )
  );

-- Create messages table for inbox
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages for their clients"
  ON public.messages
  FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN agencies a ON c.agency_id = a.id
      WHERE a.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'client')
    OR sender_id = auth.uid()
  );

CREATE POLICY "Users can create messages for their clients"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    (client_id IN (
      SELECT c.id FROM clients c
      JOIN agencies a ON c.agency_id = a.id
      WHERE a.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'client'))
    AND sender_id = auth.uid()
  );

-- Create team_members table
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  assigned_clients UUID[] DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(agency_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view team members in their agency"
  ON public.team_members
  FOR SELECT
  USING (
    agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Owners can manage team members"
  ON public.team_members
  FOR ALL
  USING (
    agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
    )
  );

-- Add triggers for updated_at
CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ideas_updated_at
  BEFORE UPDATE ON public.ideas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_captions_updated_at
  BEFORE UPDATE ON public.captions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('client-logos', 'client-logos', true),
  ('assets', 'assets', true);

-- Storage policies for client logos
CREATE POLICY "Users can view client logos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'client-logos');

CREATE POLICY "Users can upload client logos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'client-logos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update client logos"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'client-logos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete client logos"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'client-logos'
    AND auth.role() = 'authenticated'
  );

-- Storage policies for assets
CREATE POLICY "Users can view assets"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'assets');

CREATE POLICY "Users can upload assets"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'assets'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update assets"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'assets'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete assets"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'assets'
    AND auth.role() = 'authenticated'
  );

-- Function to automatically assign owner role on agency creation
CREATE OR REPLACE FUNCTION public.handle_agency_owner_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, 'owner')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_agency_created
  AFTER INSERT ON public.agencies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_agency_owner_role();