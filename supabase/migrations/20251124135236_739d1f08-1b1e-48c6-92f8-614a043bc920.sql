-- Create client_brand_voice table
CREATE TABLE IF NOT EXISTS public.client_brand_voice (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tone JSONB NOT NULL DEFAULT '[]'::jsonb,
  vocabulary JSONB NOT NULL DEFAULT '[]'::jsonb,
  rules JSONB NOT NULL DEFAULT '{"do": [], "dont": []}'::jsonb,
  examples JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

-- Enable RLS
ALTER TABLE public.client_brand_voice ENABLE ROW LEVEL SECURITY;

-- Agency members can view brand voice for their clients
CREATE POLICY "Agency members can view brand voice"
  ON public.client_brand_voice
  FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN agency_members am ON c.agency_id = am.agency_id
      WHERE am.user_id = auth.uid()
    )
  );

-- Agency members can insert brand voice for their clients
CREATE POLICY "Agency members can insert brand voice"
  ON public.client_brand_voice
  FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN agency_members am ON c.agency_id = am.agency_id
      WHERE am.user_id = auth.uid()
    )
  );

-- Agency members can update brand voice for their clients
CREATE POLICY "Agency members can update brand voice"
  ON public.client_brand_voice
  FOR UPDATE
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN agency_members am ON c.agency_id = am.agency_id
      WHERE am.user_id = auth.uid()
    )
  );

-- Agency members can delete brand voice for their clients
CREATE POLICY "Agency members can delete brand voice"
  ON public.client_brand_voice
  FOR DELETE
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN agency_members am ON c.agency_id = am.agency_id
      WHERE am.user_id = auth.uid()
    )
  );

-- Add updated_at trigger
CREATE TRIGGER update_client_brand_voice_updated_at
  BEFORE UPDATE ON public.client_brand_voice
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_client_brand_voice_client_id ON public.client_brand_voice(client_id);
CREATE INDEX idx_client_brand_voice_agency_id ON public.client_brand_voice(agency_id);