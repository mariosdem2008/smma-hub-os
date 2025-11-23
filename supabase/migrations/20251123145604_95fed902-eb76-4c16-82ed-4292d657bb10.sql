-- Allow client portal users to view their client data
-- This ensures portal users can see all data for the client they have access to

-- Client branding data
DROP POLICY IF EXISTS "Client portal users can view branding" ON public.client_branding;
CREATE POLICY "Client portal users can view branding"
ON public.client_branding
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT client_id 
    FROM client_portal_users 
    WHERE user_id = auth.uid()
  )
);

-- Content pillars
DROP POLICY IF EXISTS "Client portal users can view content pillars" ON public.client_content_pillars;
CREATE POLICY "Client portal users can view content pillars"
ON public.client_content_pillars
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT client_id 
    FROM client_portal_users 
    WHERE user_id = auth.uid()
  )
);

-- Hashtags
DROP POLICY IF EXISTS "Client portal users can view hashtags" ON public.client_hashtags;
CREATE POLICY "Client portal users can view hashtags"
ON public.client_hashtags
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT client_id 
    FROM client_portal_users 
    WHERE user_id = auth.uid()
  )
);

-- Saved captions
DROP POLICY IF EXISTS "Client portal users can view saved captions" ON public.client_saved_captions;
CREATE POLICY "Client portal users can view saved captions"
ON public.client_saved_captions
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT client_id 
    FROM client_portal_users 
    WHERE user_id = auth.uid()
  )
);

-- Inspiration
DROP POLICY IF EXISTS "Client portal users can view inspiration" ON public.client_inspiration;
CREATE POLICY "Client portal users can view inspiration"
ON public.client_inspiration
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT client_id 
    FROM client_portal_users 
    WHERE user_id = auth.uid()
  )
);

-- Posts (content calendar)
DROP POLICY IF EXISTS "Client portal users can view posts" ON public.posts;
CREATE POLICY "Client portal users can view posts"
ON public.posts
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT client_id 
    FROM client_portal_users 
    WHERE user_id = auth.uid()
  )
);

-- Social profiles
DROP POLICY IF EXISTS "Client portal users can view social profiles" ON public.social_profiles;
CREATE POLICY "Client portal users can view social profiles"
ON public.social_profiles
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT client_id 
    FROM client_portal_users 
    WHERE user_id = auth.uid()
  )
);