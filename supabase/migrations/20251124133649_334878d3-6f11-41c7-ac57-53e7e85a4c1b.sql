-- =====================================================
-- AI CONTENT ASSISTANT: USAGE TRACKING
-- =====================================================

-- Create table to track AI generation usage
CREATE TABLE IF NOT EXISTS public.ai_generation_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agency_id UUID NOT NULL,
  generation_type TEXT NOT NULL CHECK (generation_type IN ('caption', 'idea')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  month_year TEXT NOT NULL, -- Format: YYYY-MM for grouping by month
  CONSTRAINT fk_agency FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.ai_generation_usage ENABLE ROW LEVEL SECURITY;

-- Agency members can view their own agency usage
CREATE POLICY "Agency members can view usage"
  ON public.ai_generation_usage
  FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id 
      FROM public.agency_members 
      WHERE user_id = auth.uid()
    )
  );

-- Agency members can insert usage
CREATE POLICY "Agency members can insert usage"
  ON public.ai_generation_usage
  FOR INSERT
  WITH CHECK (
    agency_id IN (
      SELECT agency_id 
      FROM public.agency_members 
      WHERE user_id = auth.uid()
    ) AND user_id = auth.uid()
  );

-- Create index for efficient month-based queries
CREATE INDEX idx_ai_usage_month_agency ON public.ai_generation_usage(month_year, agency_id);

-- Function to get current month's usage count for an agency
CREATE OR REPLACE FUNCTION public.get_monthly_ai_usage(p_agency_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.ai_generation_usage
  WHERE agency_id = p_agency_id
    AND month_year = TO_CHAR(NOW(), 'YYYY-MM');
$$;