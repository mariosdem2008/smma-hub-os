-- Create client_portal_users table
CREATE TABLE public.client_portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'client_viewer' CHECK (role IN ('client_viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, user_id)
);

-- Add portal fields to clients table
ALTER TABLE public.clients 
ADD COLUMN portal_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN portal_slug TEXT UNIQUE,
ADD COLUMN portal_share_token TEXT UNIQUE;

-- Enable RLS on client_portal_users
ALTER TABLE public.client_portal_users ENABLE ROW LEVEL SECURITY;

-- RLS: Client portal users can view their own record
CREATE POLICY "Client portal users can view own record"
ON public.client_portal_users
FOR SELECT
USING (auth.uid() = user_id);

-- RLS: Agency members can view portal users for their clients
CREATE POLICY "Agency members can view portal users"
ON public.client_portal_users
FOR SELECT
USING (
  client_id IN (
    SELECT c.id
    FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

-- RLS: Agency members can insert portal users for their clients
CREATE POLICY "Agency members can create portal users"
ON public.client_portal_users
FOR INSERT
WITH CHECK (
  client_id IN (
    SELECT c.id
    FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

-- RLS: Agency members can delete portal users for their clients
CREATE POLICY "Agency members can delete portal users"
ON public.client_portal_users
FOR DELETE
USING (
  client_id IN (
    SELECT c.id
    FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

-- RLS: Client portal users can view their assigned client
CREATE POLICY "Client portal users can view assigned client"
ON public.clients
FOR SELECT
USING (
  id IN (
    SELECT client_id
    FROM client_portal_users
    WHERE user_id = auth.uid()
  )
);

-- RLS: Client portal users can view ideas for their client
CREATE POLICY "Client portal users can view ideas"
ON public.client_ideas
FOR SELECT
USING (
  client_id IN (
    SELECT client_id
    FROM client_portal_users
    WHERE user_id = auth.uid()
  )
);

-- RLS: Client portal users can create ideas for their client
CREATE POLICY "Client portal users can create ideas"
ON public.client_ideas
FOR INSERT
WITH CHECK (
  client_id IN (
    SELECT client_id
    FROM client_portal_users
    WHERE user_id = auth.uid()
  )
);

-- RLS: Client portal users can view assets for their client
CREATE POLICY "Client portal users can view assets"
ON public.assets
FOR SELECT
USING (
  client_id IN (
    SELECT client_id
    FROM client_portal_users
    WHERE user_id = auth.uid()
  )
);

-- RLS: Client portal users can upload assets for their client
CREATE POLICY "Client portal users can create assets"
ON public.assets
FOR INSERT
WITH CHECK (
  client_id IN (
    SELECT client_id
    FROM client_portal_users
    WHERE user_id = auth.uid()
  )
);

-- Create function to generate portal slug
CREATE OR REPLACE FUNCTION public.generate_portal_slug()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_slug TEXT;
  slug_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate random 8-character slug
    new_slug := lower(substring(md5(random()::text) from 1 for 8));
    
    -- Check if slug exists
    SELECT EXISTS(SELECT 1 FROM clients WHERE portal_slug = new_slug) INTO slug_exists;
    
    -- Exit loop if slug is unique
    EXIT WHEN NOT slug_exists;
  END LOOP;
  
  RETURN new_slug;
END;
$$;

-- Create function to generate portal share token
CREATE OR REPLACE FUNCTION public.generate_portal_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$;