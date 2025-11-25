-- Add 'failed' status to pipeline_stage enum
ALTER TYPE pipeline_stage ADD VALUE IF NOT EXISTS 'failed';

-- Add error_message field to assets table for storing posting errors
ALTER TABLE public.assets
ADD COLUMN IF NOT EXISTS error_message text;

-- Create index on scheduled assets for efficient querying
CREATE INDEX IF NOT EXISTS idx_assets_scheduled_time 
ON public.assets(scheduled_time) 
WHERE pipeline_stage = 'scheduled';