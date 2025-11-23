-- Fix RLS policies to allow both agency owners and members

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view clients from their agency" ON clients;
DROP POLICY IF EXISTS "Users can insert clients for their agency" ON clients;
DROP POLICY IF EXISTS "Users can update clients from their agency" ON clients;
DROP POLICY IF EXISTS "Users can delete clients from their agency" ON clients;

-- Create new policies that check BOTH agencies (owners) and agency_members (team members)
CREATE POLICY "Users can view clients from their agency"
ON clients FOR SELECT
TO authenticated
USING (
  agency_id IN (
    SELECT id FROM agencies WHERE user_id = auth.uid()
    UNION
    SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert clients for their agency"
ON clients FOR INSERT
TO authenticated
WITH CHECK (
  agency_id IN (
    SELECT id FROM agencies WHERE user_id = auth.uid()
    UNION
    SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update clients from their agency"
ON clients FOR UPDATE
TO authenticated
USING (
  agency_id IN (
    SELECT id FROM agencies WHERE user_id = auth.uid()
    UNION
    SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete clients from their agency"
ON clients FOR DELETE
TO authenticated
USING (
  agency_id IN (
    SELECT id FROM agencies WHERE user_id = auth.uid()
    UNION
    SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
  )
);

-- Apply same pattern to posts
DROP POLICY IF EXISTS "Users can view posts from their agency" ON posts;
DROP POLICY IF EXISTS "Users can insert posts for their agency" ON posts;
DROP POLICY IF EXISTS "Users can update posts from their agency" ON posts;
DROP POLICY IF EXISTS "Users can delete posts from their agency" ON posts;

CREATE POLICY "Users can view posts from their agency"
ON posts FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can insert posts for their agency"
ON posts FOR INSERT
TO authenticated
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update posts from their agency"
ON posts FOR UPDATE
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can delete posts from their agency"
ON posts FOR DELETE
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

-- Apply same pattern to tasks
DROP POLICY IF EXISTS "Users can view tasks from their agency" ON tasks;
DROP POLICY IF EXISTS "Users can insert tasks for their agency" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks from their agency" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks from their agency" ON tasks;

CREATE POLICY "Users can view tasks from their agency"
ON tasks FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can insert tasks for their agency"
ON tasks FOR INSERT
TO authenticated
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update tasks from their agency"
ON tasks FOR UPDATE
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can delete tasks from their agency"
ON tasks FOR DELETE
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

-- Apply same pattern to social_profiles
DROP POLICY IF EXISTS "Users can view social profiles from their agency" ON social_profiles;
DROP POLICY IF EXISTS "Users can insert social profiles for their agency" ON social_profiles;
DROP POLICY IF EXISTS "Users can update social profiles from their agency" ON social_profiles;
DROP POLICY IF EXISTS "Users can delete social profiles from their agency" ON social_profiles;

CREATE POLICY "Users can view social profiles from their agency"
ON social_profiles FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can insert social profiles for their agency"
ON social_profiles FOR INSERT
TO authenticated
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update social profiles from their agency"
ON social_profiles FOR UPDATE
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can delete social profiles from their agency"
ON social_profiles FOR DELETE
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

-- Apply same pattern to assets
DROP POLICY IF EXISTS "Users can view assets from their agency" ON assets;
DROP POLICY IF EXISTS "Users can insert assets for their agency" ON assets;
DROP POLICY IF EXISTS "Users can update assets from their agency" ON assets;
DROP POLICY IF EXISTS "Users can delete assets from their agency" ON assets;

CREATE POLICY "Users can view assets from their agency"
ON assets FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can insert assets for their agency"
ON assets FOR INSERT
TO authenticated
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update assets from their agency"
ON assets FOR UPDATE
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can delete assets from their agency"
ON assets FOR DELETE
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

-- Apply same pattern to captions
DROP POLICY IF EXISTS "Users can view captions from their agency" ON captions;
DROP POLICY IF EXISTS "Users can insert captions for their agency" ON captions;
DROP POLICY IF EXISTS "Users can update captions from their agency" ON captions;
DROP POLICY IF EXISTS "Users can delete captions from their agency" ON captions;

CREATE POLICY "Users can view captions from their agency"
ON captions FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can insert captions for their agency"
ON captions FOR INSERT
TO authenticated
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update captions from their agency"
ON captions FOR UPDATE
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can delete captions from their agency"
ON captions FOR DELETE
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

-- Apply same pattern to ideas
DROP POLICY IF EXISTS "Users can view ideas from their agency" ON ideas;
DROP POLICY IF EXISTS "Users can insert ideas for their agency" ON ideas;
DROP POLICY IF EXISTS "Users can update ideas from their agency" ON ideas;
DROP POLICY IF EXISTS "Users can delete ideas from their agency" ON ideas;

CREATE POLICY "Users can view ideas from their agency"
ON ideas FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can insert ideas for their agency"
ON ideas FOR INSERT
TO authenticated
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update ideas from their agency"
ON ideas FOR UPDATE
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can delete ideas from their agency"
ON ideas FOR DELETE
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

-- Apply same pattern to messages
DROP POLICY IF EXISTS "Users can view messages from their agency" ON messages;
DROP POLICY IF EXISTS "Users can insert messages for their agency" ON messages;
DROP POLICY IF EXISTS "Users can update messages from their agency" ON messages;
DROP POLICY IF EXISTS "Users can delete messages from their agency" ON messages;

CREATE POLICY "Users can view messages from their agency"
ON messages FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can insert messages for their agency"
ON messages FOR INSERT
TO authenticated
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update messages from their agency"
ON messages FOR UPDATE
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can delete messages from their agency"
ON messages FOR DELETE
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id IN (
      SELECT id FROM agencies WHERE user_id = auth.uid()
      UNION
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);