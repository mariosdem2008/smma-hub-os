-- Create client_reports table for storing monthly analytics reports
CREATE TABLE IF NOT EXISTS public.client_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- Format: YYYY-MM
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_client_reports_agency_id ON public.client_reports(agency_id);
CREATE INDEX IF NOT EXISTS idx_client_reports_client_id ON public.client_reports(client_id);
CREATE INDEX IF NOT EXISTS idx_client_reports_month ON public.client_reports(month);
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_reports_unique_month ON public.client_reports(client_id, month);

-- Enable RLS
ALTER TABLE public.client_reports ENABLE ROW LEVEL SECURITY;

-- Agency members can view and create reports for their clients
CREATE POLICY "agency_members_view_reports" ON public.client_reports
  FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id FROM public.agency_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "agency_members_create_reports" ON public.client_reports
  FOR INSERT
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM public.agency_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "agency_members_update_reports" ON public.client_reports
  FOR UPDATE
  USING (
    agency_id IN (
      SELECT agency_id FROM public.agency_members
      WHERE user_id = auth.uid()
    )
  );

-- Client portal users can view their own client reports
CREATE POLICY "client_users_view_reports" ON public.client_reports
  FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM public.client_users
      WHERE id = auth.uid()
    )
  );

-- Add updated_at trigger
CREATE TRIGGER update_client_reports_updated_at
  BEFORE UPDATE ON public.client_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();