-- Ensure only agency owners can modify subscription data
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;

-- Create new policies with owner-only write access
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Only owners can update subscriptions"
  ON public.subscriptions
  FOR UPDATE
  TO authenticated
  USING (
    -- User must be the agency owner
    EXISTS (
      SELECT 1 FROM public.agencies
      WHERE agencies.user_id = auth.uid()
      AND agencies.user_id = subscriptions.user_id
    )
  );

CREATE POLICY "Service role full access"
  ON public.subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);