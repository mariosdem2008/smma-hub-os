-- Create client_saved_captions table
CREATE TABLE public.client_saved_captions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  caption TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_saved_captions ENABLE ROW LEVEL SECURITY;

-- RLS policies for client_saved_captions
CREATE POLICY "Agency members can view saved captions"
ON public.client_saved_captions FOR SELECT
USING (
  client_id IN (
    SELECT c.id
    FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can insert saved captions"
ON public.client_saved_captions FOR INSERT
WITH CHECK (
  client_id IN (
    SELECT c.id
    FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can update saved captions"
ON public.client_saved_captions FOR UPDATE
USING (
  client_id IN (
    SELECT c.id
    FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can delete saved captions"
ON public.client_saved_captions FOR DELETE
USING (
  client_id IN (
    SELECT c.id
    FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);