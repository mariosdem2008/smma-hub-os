-- Add RLS policy for client portal users to view assets in review stage
CREATE POLICY "Client portal users can view review stage assets"
ON public.assets
FOR SELECT
USING (
  pipeline_stage = 'review' 
  AND client_id IN (
    SELECT client_id 
    FROM public.client_users 
    WHERE id = auth.uid()
  )
);

-- Add RLS policy for client portal users to update assets (for approval flow)
CREATE POLICY "Client portal users can update review stage assets"
ON public.assets
FOR UPDATE
USING (
  pipeline_stage = 'review' 
  AND client_id IN (
    SELECT client_id 
    FROM public.client_users 
    WHERE id = auth.uid()
  )
);