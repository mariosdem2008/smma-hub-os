-- Drop existing policies that check agencies.user_id
DROP POLICY IF EXISTS "Users can view own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can create clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON public.clients;

DROP POLICY IF EXISTS "Users can view posts for their clients" ON public.posts;
DROP POLICY IF EXISTS "Users can create posts for their clients" ON public.posts;
DROP POLICY IF EXISTS "Users can update posts for their clients" ON public.posts;
DROP POLICY IF EXISTS "Users can delete posts for their clients" ON public.posts;

DROP POLICY IF EXISTS "Users can view tasks for their clients" ON public.tasks;
DROP POLICY IF EXISTS "Users can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete tasks" ON public.tasks;

DROP POLICY IF EXISTS "Users can view social profiles for their clients" ON public.social_profiles;
DROP POLICY IF EXISTS "Users can create social profiles for their clients" ON public.social_profiles;
DROP POLICY IF EXISTS "Users can update social profiles for their clients" ON public.social_profiles;
DROP POLICY IF EXISTS "Users can delete social profiles for their clients" ON public.social_profiles;

DROP POLICY IF EXISTS "Users can view assets for their clients" ON public.assets;
DROP POLICY IF EXISTS "Users can create assets for their clients" ON public.assets;
DROP POLICY IF EXISTS "Users can update assets for their clients" ON public.assets;
DROP POLICY IF EXISTS "Users can delete assets for their clients" ON public.assets;

DROP POLICY IF EXISTS "Users can view captions for their clients" ON public.captions;
DROP POLICY IF EXISTS "Users can create captions for their clients" ON public.captions;
DROP POLICY IF EXISTS "Users can update captions for their clients" ON public.captions;
DROP POLICY IF EXISTS "Users can delete captions for their clients" ON public.captions;

DROP POLICY IF EXISTS "Users can view ideas for their clients" ON public.ideas;
DROP POLICY IF EXISTS "Users can create ideas for their clients" ON public.ideas;
DROP POLICY IF EXISTS "Users can update ideas for their clients" ON public.ideas;
DROP POLICY IF EXISTS "Users can delete ideas for their clients" ON public.ideas;

DROP POLICY IF EXISTS "Users can view messages for their clients" ON public.messages;
DROP POLICY IF EXISTS "Users can create messages for their clients" ON public.messages;

-- Create new policies using agency_members

-- Clients policies
CREATE POLICY "Agency members can view clients"
ON public.clients FOR SELECT
USING (
  agency_id IN (
    SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can create clients"
ON public.clients FOR INSERT
WITH CHECK (
  agency_id IN (
    SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can update clients"
ON public.clients FOR UPDATE
USING (
  agency_id IN (
    SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can delete clients"
ON public.clients FOR DELETE
USING (
  agency_id IN (
    SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
  )
);

-- Posts policies
CREATE POLICY "Agency members can view posts"
ON public.posts FOR SELECT
USING (
  client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can create posts"
ON public.posts FOR INSERT
WITH CHECK (
  client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can update posts"
ON public.posts FOR UPDATE
USING (
  client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can delete posts"
ON public.posts FOR DELETE
USING (
  client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

-- Tasks policies
CREATE POLICY "Agency members can view tasks"
ON public.tasks FOR SELECT
USING (
  client_id IS NULL OR client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can create tasks"
ON public.tasks FOR INSERT
WITH CHECK (
  client_id IS NULL OR client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can update tasks"
ON public.tasks FOR UPDATE
USING (
  client_id IS NULL OR client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can delete tasks"
ON public.tasks FOR DELETE
USING (
  client_id IS NULL OR client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

-- Social profiles policies
CREATE POLICY "Agency members can view social profiles"
ON public.social_profiles FOR SELECT
USING (
  client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can create social profiles"
ON public.social_profiles FOR INSERT
WITH CHECK (
  client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can update social profiles"
ON public.social_profiles FOR UPDATE
USING (
  client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can delete social profiles"
ON public.social_profiles FOR DELETE
USING (
  client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

-- Assets policies
CREATE POLICY "Agency members can view assets"
ON public.assets FOR SELECT
USING (
  client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  ) OR has_role(auth.uid(), 'client'::app_role)
);

CREATE POLICY "Agency members can create assets"
ON public.assets FOR INSERT
WITH CHECK (
  client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  ) OR has_role(auth.uid(), 'client'::app_role)
);

CREATE POLICY "Agency members can update assets"
ON public.assets FOR UPDATE
USING (
  client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can delete assets"
ON public.assets FOR DELETE
USING (
  client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

-- Captions policies
CREATE POLICY "Agency members can view captions"
ON public.captions FOR SELECT
USING (
  client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  ) OR has_role(auth.uid(), 'client'::app_role)
);

CREATE POLICY "Agency members can create captions"
ON public.captions FOR INSERT
WITH CHECK (
  client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can update captions"
ON public.captions FOR UPDATE
USING (
  client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can delete captions"
ON public.captions FOR DELETE
USING (
  client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

-- Ideas policies
CREATE POLICY "Agency members can view ideas"
ON public.ideas FOR SELECT
USING (
  client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  ) OR has_role(auth.uid(), 'client'::app_role)
);

CREATE POLICY "Agency members can create ideas"
ON public.ideas FOR INSERT
WITH CHECK (
  client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can update ideas"
ON public.ideas FOR UPDATE
USING (
  client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can delete ideas"
ON public.ideas FOR DELETE
USING (
  client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

-- Messages policies
CREATE POLICY "Agency members can view messages"
ON public.messages FOR SELECT
USING (
  client_id IN (
    SELECT c.id FROM public.clients c
    INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  ) OR has_role(auth.uid(), 'client'::app_role) OR sender_id = auth.uid()
);

CREATE POLICY "Agency members can create messages"
ON public.messages FOR INSERT
WITH CHECK (
  (
    client_id IN (
      SELECT c.id FROM public.clients c
      INNER JOIN public.agency_members am ON c.agency_id = am.agency_id
      WHERE am.user_id = auth.uid()
    ) OR has_role(auth.uid(), 'client'::app_role)
  ) AND sender_id = auth.uid()
);