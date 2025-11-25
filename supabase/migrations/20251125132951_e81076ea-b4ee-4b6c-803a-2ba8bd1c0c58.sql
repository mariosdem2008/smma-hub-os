-- Add multi-level approval configuration
CREATE TABLE IF NOT EXISTS public.client_approval_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  approver_order INTEGER NOT NULL,
  approver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, approver_order)
);

-- Enable RLS
ALTER TABLE public.client_approval_workflows ENABLE ROW LEVEL SECURITY;

-- RLS Policies for approval workflows
CREATE POLICY "Agency members can manage approval workflows"
ON public.client_approval_workflows
FOR ALL
USING (
  client_id IN (
    SELECT c.id FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Client portal users can view approval workflows"
ON public.client_approval_workflows
FOR SELECT
USING (
  client_id IN (
    SELECT client_id FROM client_portal_users WHERE user_id = auth.uid()
  )
);

-- Function to get next approver in sequence
CREATE OR REPLACE FUNCTION public.get_next_approver(
  p_client_id UUID,
  p_asset_id UUID
)
RETURNS TABLE (
  user_id UUID,
  role_name TEXT,
  approver_order INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_order INTEGER;
BEGIN
  -- Get the highest completed approval order
  SELECT COALESCE(MAX(caw.approver_order), 0) INTO v_current_order
  FROM approval_tasks at
  JOIN asset_versions av ON at.asset_version_id = av.id
  JOIN assets a ON av.asset_id = a.id
  JOIN client_approval_workflows caw ON caw.approver_id = at.approver_id AND caw.client_id = a.client_id
  WHERE a.id = p_asset_id
    AND at.status = 'approved';

  -- Return next approver in sequence
  RETURN QUERY
  SELECT 
    caw.approver_id,
    caw.role_name,
    caw.approver_order
  FROM client_approval_workflows caw
  WHERE caw.client_id = p_client_id
    AND caw.approver_order = v_current_order + 1
  LIMIT 1;
END;
$$;

-- Add trigger for updated_at
CREATE TRIGGER update_client_approval_workflows_updated_at
BEFORE UPDATE ON public.client_approval_workflows
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_client_approval_workflows_client ON public.client_approval_workflows(client_id);
CREATE INDEX IF NOT EXISTS idx_client_approval_workflows_approver ON public.client_approval_workflows(approver_id);
CREATE INDEX IF NOT EXISTS idx_client_approval_workflows_order ON public.client_approval_workflows(client_id, approver_order);

-- Comments
COMMENT ON TABLE public.client_approval_workflows IS 'Defines multi-level approval sequences per client with ordered approvers';
COMMENT ON FUNCTION public.get_next_approver IS 'Returns the next approver in the approval workflow sequence for a given asset';
