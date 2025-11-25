-- Allow public (including client portal) to view assets that are in review stage
CREATE POLICY "Public can view review assets"
ON public.assets
FOR SELECT
USING (pipeline_stage = 'review');