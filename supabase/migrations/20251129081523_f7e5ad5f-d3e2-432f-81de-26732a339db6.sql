-- Create helper functions for role-based authorization
CREATE OR REPLACE FUNCTION public.is_agency_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agency_members
    WHERE user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_client_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_users
    WHERE id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_client_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_id
  FROM public.client_users
  WHERE id = _user_id
  LIMIT 1;
$$;

-- ========================================
-- PROJECTS TABLE RLS - Complete Cleanup
-- ========================================

-- Drop ALL existing policies on projects table
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'projects' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.projects', pol.policyname);
  END LOOP;
END $$;

-- Create clean, secure policies for projects
CREATE POLICY "agency_members_manage_projects"
ON public.projects
FOR ALL
TO authenticated
USING (
  agency_id IN (
    SELECT agency_id
    FROM public.agency_members
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  agency_id IN (
    SELECT agency_id
    FROM public.agency_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "client_users_view_projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  public.is_client_user(auth.uid())
  AND client_id = public.get_user_client_id(auth.uid())
  AND pipeline_stage IN ('review', 'approved', 'scheduled', 'published')
);

CREATE POLICY "client_users_update_review_projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  public.is_client_user(auth.uid())
  AND client_id = public.get_user_client_id(auth.uid())
  AND pipeline_stage = 'review'
)
WITH CHECK (
  public.is_client_user(auth.uid())
  AND client_id = public.get_user_client_id(auth.uid())
);

-- ========================================
-- ASSETS TABLE RLS - Complete Cleanup
-- ========================================

-- Drop ALL existing policies on assets table
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'assets' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.assets', pol.policyname);
  END LOOP;
END $$;

-- Create clean, secure policies for assets
CREATE POLICY "agency_members_manage_assets"
ON public.assets
FOR ALL
TO authenticated
USING (
  client_id IN (
    SELECT c.id
    FROM public.clients c
    JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
)
WITH CHECK (
  client_id IN (
    SELECT c.id
    FROM public.clients c
    JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "client_users_view_assets"
ON public.assets
FOR SELECT
TO authenticated
USING (
  public.is_client_user(auth.uid())
  AND client_id = public.get_user_client_id(auth.uid())
);

CREATE POLICY "client_users_insert_assets"
ON public.assets
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_client_user(auth.uid())
  AND client_id = public.get_user_client_id(auth.uid())
);

-- ========================================
-- SOCIAL_CONNECTIONS TABLE RLS - Complete Cleanup
-- ========================================

-- Drop ALL existing policies on social_connections table
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'social_connections' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.social_connections', pol.policyname);
  END LOOP;
END $$;

-- Create clean, secure policies for social_connections
CREATE POLICY "agency_members_manage_social_connections"
ON public.social_connections
FOR ALL
TO authenticated
USING (
  client_id IN (
    SELECT c.id
    FROM public.clients c
    JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
)
WITH CHECK (
  client_id IN (
    SELECT c.id
    FROM public.clients c
    JOIN public.agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "client_users_manage_social_connections"
ON public.social_connections
FOR ALL
TO authenticated
USING (
  public.is_client_user(auth.uid())
  AND client_id = public.get_user_client_id(auth.uid())
)
WITH CHECK (
  public.is_client_user(auth.uid())
  AND client_id = public.get_user_client_id(auth.uid())
);