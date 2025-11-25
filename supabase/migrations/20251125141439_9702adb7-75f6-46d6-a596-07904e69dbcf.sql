-- Drop dependent policies first
DROP POLICY IF EXISTS "Client portal users can view their client data" ON public.clients;
DROP POLICY IF EXISTS "Client portal users can view visible assets" ON public.assets;
DROP POLICY IF EXISTS "Client portal users can view their approval tasks" ON public.approval_tasks;
DROP POLICY IF EXISTS "Client portal users can update their approval tasks" ON public.approval_tasks;
DROP POLICY IF EXISTS "Client portal users can view branding" ON public.client_branding;
DROP POLICY IF EXISTS "Client portal users can view content pillars" ON public.client_content_pillars;
DROP POLICY IF EXISTS "Client portal users can view hashtags" ON public.client_hashtags;
DROP POLICY IF EXISTS "Client portal users can view inspiration" ON public.client_inspiration;
DROP POLICY IF EXISTS "Client portal users can view saved captions" ON public.client_saved_captions;
DROP POLICY IF EXISTS "Client portal users can view agency branding" ON public.agency_branding;
DROP POLICY IF EXISTS "Client portal users can create asset comments" ON public.asset_comments;
DROP POLICY IF EXISTS "Client portal users can view asset comments" ON public.asset_comments;
DROP POLICY IF EXISTS "Client portal users can view approval workflows" ON public.client_approval_workflows;
DROP POLICY IF EXISTS "Client portal users can view client uploads" ON public.client_uploads;
DROP POLICY IF EXISTS "Client portal users can upload files" ON public.client_uploads;

-- Drop old tables and functions
DROP TABLE IF EXISTS public.client_portal_users CASCADE;
DROP FUNCTION IF EXISTS public.accept_portal_invitation(uuid);
DROP FUNCTION IF EXISTS public.check_portal_invitation(uuid, text);
DROP FUNCTION IF EXISTS public.is_client_portal_user(uuid, uuid) CASCADE;

-- Create client_users table
CREATE TABLE public.client_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'approver', 'viewer')),
  invitation_status TEXT NOT NULL DEFAULT 'accepted',
  password_reset_token TEXT,
  password_reset_expires_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(email, client_id)
);

-- Create client_invites table
CREATE TABLE public.client_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'approver', 'viewer')),
  invite_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours'),
  accepted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_users
CREATE POLICY "Agency members can view client users"
ON public.client_users FOR SELECT
TO authenticated
USING (
  agency_id IN (
    SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can manage client users"
ON public.client_users FOR ALL
TO authenticated
USING (
  agency_id IN (
    SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
  )
);

-- RLS Policies for client_invites
CREATE POLICY "Agency members can view invites"
ON public.client_invites FOR SELECT
TO authenticated
USING (
  agency_id IN (
    SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can manage invites"
ON public.client_invites FOR ALL
TO authenticated
USING (
  agency_id IN (
    SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
  )
);

-- Create updated_at trigger for client_users
CREATE TRIGGER update_client_users_updated_at
BEFORE UPDATE ON public.client_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();