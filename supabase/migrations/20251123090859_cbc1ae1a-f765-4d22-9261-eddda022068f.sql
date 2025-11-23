-- Create social_connections table
CREATE TABLE public.social_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'youtube', 'linkedin')),
  account_name text,
  account_handle text,
  account_id text,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),
  access_token text,
  refresh_token text,
  token_expires_at timestamp with time zone,
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agency members
CREATE POLICY "Agency members can view social connections"
ON public.social_connections
FOR SELECT
USING (
  client_id IN (
    SELECT c.id
    FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can insert social connections"
ON public.social_connections
FOR INSERT
WITH CHECK (
  client_id IN (
    SELECT c.id
    FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can update social connections"
ON public.social_connections
FOR UPDATE
USING (
  client_id IN (
    SELECT c.id
    FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can delete social connections"
ON public.social_connections
FOR DELETE
USING (
  client_id IN (
    SELECT c.id
    FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

-- RLS Policies for agency owners
CREATE POLICY "Agency owners can view social connections"
ON public.social_connections
FOR SELECT
USING (
  client_id IN (
    SELECT clients.id
    FROM clients
    WHERE clients.agency_id IN (
      SELECT agencies.id
      FROM agencies
      WHERE agencies.user_id = auth.uid()
      UNION
      SELECT agency_members.agency_id
      FROM agency_members
      WHERE agency_members.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Agency owners can insert social connections"
ON public.social_connections
FOR INSERT
WITH CHECK (
  client_id IN (
    SELECT clients.id
    FROM clients
    WHERE clients.agency_id IN (
      SELECT agencies.id
      FROM agencies
      WHERE agencies.user_id = auth.uid()
      UNION
      SELECT agency_members.agency_id
      FROM agency_members
      WHERE agency_members.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Agency owners can update social connections"
ON public.social_connections
FOR UPDATE
USING (
  client_id IN (
    SELECT clients.id
    FROM clients
    WHERE clients.agency_id IN (
      SELECT agencies.id
      FROM agencies
      WHERE agencies.user_id = auth.uid()
      UNION
      SELECT agency_members.agency_id
      FROM agency_members
      WHERE agency_members.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Agency owners can delete social connections"
ON public.social_connections
FOR DELETE
USING (
  client_id IN (
    SELECT clients.id
    FROM clients
    WHERE clients.agency_id IN (
      SELECT agencies.id
      FROM agencies
      WHERE agencies.user_id = auth.uid()
      UNION
      SELECT agency_members.agency_id
      FROM agency_members
      WHERE agency_members.user_id = auth.uid()
    )
  )
);

-- Add trigger for automatic updated_at timestamp
CREATE TRIGGER update_social_connections_updated_at
BEFORE UPDATE ON public.social_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();