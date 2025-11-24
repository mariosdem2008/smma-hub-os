-- Create agency_branding table
CREATE TABLE IF NOT EXISTS public.agency_branding (
  agency_id uuid PRIMARY KEY REFERENCES public.agencies(id) ON DELETE CASCADE,
  logo_url text,
  primary_color text DEFAULT '#6366f1',
  accent_color text DEFAULT '#8b5cf6',
  custom_domain text,
  email_sender_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agency_branding ENABLE ROW LEVEL SECURITY;

-- Only agency owners/admins can view their branding
CREATE POLICY "Agency admins can view branding"
  ON public.agency_branding
  FOR SELECT
  USING (is_agency_admin(agency_id, auth.uid()));

-- Only agency owners/admins can insert branding
CREATE POLICY "Agency admins can insert branding"
  ON public.agency_branding
  FOR INSERT
  WITH CHECK (is_agency_admin(agency_id, auth.uid()));

-- Only agency owners/admins can update branding
CREATE POLICY "Agency admins can update branding"
  ON public.agency_branding
  FOR UPDATE
  USING (is_agency_admin(agency_id, auth.uid()));

-- Only agency owners/admins can delete branding
CREATE POLICY "Agency admins can delete branding"
  ON public.agency_branding
  FOR DELETE
  USING (is_agency_admin(agency_id, auth.uid()));

-- Client portal users can view branding for their client's agency
CREATE POLICY "Client portal users can view agency branding"
  ON public.agency_branding
  FOR SELECT
  USING (
    agency_id IN (
      SELECT c.agency_id
      FROM public.clients c
      JOIN public.client_portal_users cpu ON cpu.client_id = c.id
      WHERE cpu.user_id = auth.uid()
    )
  );

-- Public can view branding for enabled portals by custom domain
CREATE POLICY "Public can view branding by domain"
  ON public.agency_branding
  FOR SELECT
  USING (custom_domain IS NOT NULL);

-- Trigger to update updated_at
CREATE TRIGGER update_agency_branding_updated_at
  BEFORE UPDATE ON public.agency_branding
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();