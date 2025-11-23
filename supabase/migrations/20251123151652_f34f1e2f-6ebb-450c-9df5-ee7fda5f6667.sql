-- Add new columns to assets table for status tracking and categorization
ALTER TABLE public.assets
ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'published')),
ADD COLUMN IF NOT EXISTS visible_to_client boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS custom_category text;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_visible_to_client ON public.assets(visible_to_client);
CREATE INDEX IF NOT EXISTS idx_assets_custom_category ON public.assets(custom_category);

-- Update RLS policy for client portal users to only see visible assets
DROP POLICY IF EXISTS "Client portal users can view assets" ON public.assets;

CREATE POLICY "Client portal users can view visible assets"
ON public.assets
FOR SELECT
USING (
  visible_to_client = true 
  AND client_id IN (
    SELECT client_id 
    FROM client_portal_users 
    WHERE user_id = auth.uid()
  )
);