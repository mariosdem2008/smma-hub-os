-- Add new fields to clients table
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS niche text,
ADD COLUMN IF NOT EXISTS tone_of_voice text;

-- Remove social URL fields from clients table
ALTER TABLE public.clients
DROP COLUMN IF EXISTS instagram_url,
DROP COLUMN IF EXISTS facebook_url,
DROP COLUMN IF EXISTS tiktok_url,
DROP COLUMN IF EXISTS linkedin_url,
DROP COLUMN IF EXISTS youtube_url;

-- Create social_profiles table
CREATE TABLE IF NOT EXISTS public.social_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform text NOT NULL,
  url text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on social_profiles
ALTER TABLE public.social_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for social_profiles
CREATE POLICY "Users can view social profiles for their clients"
ON public.social_profiles
FOR SELECT
USING (
  client_id IN (
    SELECT c.id FROM clients c
    JOIN agencies a ON c.agency_id = a.id
    WHERE a.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create social profiles for their clients"
ON public.social_profiles
FOR INSERT
WITH CHECK (
  client_id IN (
    SELECT c.id FROM clients c
    JOIN agencies a ON c.agency_id = a.id
    WHERE a.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update social profiles for their clients"
ON public.social_profiles
FOR UPDATE
USING (
  client_id IN (
    SELECT c.id FROM clients c
    JOIN agencies a ON c.agency_id = a.id
    WHERE a.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete social profiles for their clients"
ON public.social_profiles
FOR DELETE
USING (
  client_id IN (
    SELECT c.id FROM clients c
    JOIN agencies a ON c.agency_id = a.id
    WHERE a.user_id = auth.uid()
  )
);