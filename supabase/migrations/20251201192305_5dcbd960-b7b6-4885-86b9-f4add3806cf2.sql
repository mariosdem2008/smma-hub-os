-- Create ai_history table for audit logging
CREATE TABLE IF NOT EXISTS public.ai_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  mode text NOT NULL,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Agency members can read/write their own agency's AI history
CREATE POLICY "Agency members can insert AI history"
  ON public.ai_history
  FOR INSERT
  WITH CHECK (
    agency_id IN (
      SELECT agency_id 
      FROM public.agency_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Agency members can view AI history"
  ON public.ai_history
  FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id 
      FROM public.agency_members 
      WHERE user_id = auth.uid()
    )
  );

-- Add indexes for performance
CREATE INDEX idx_ai_history_agency_id ON public.ai_history(agency_id);
CREATE INDEX idx_ai_history_client_id ON public.ai_history(client_id);
CREATE INDEX idx_ai_history_project_id ON public.ai_history(project_id);
CREATE INDEX idx_ai_history_created_at ON public.ai_history(created_at DESC);