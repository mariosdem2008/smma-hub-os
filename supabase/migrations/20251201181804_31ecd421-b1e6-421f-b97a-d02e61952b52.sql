-- Add retry_count field to scheduled_posts table
ALTER TABLE public.scheduled_posts 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Add scheduled_post_id to post_logs table for better tracking
ALTER TABLE public.post_logs 
ADD COLUMN IF NOT EXISTS scheduled_post_id UUID REFERENCES public.scheduled_posts(id) ON DELETE SET NULL;

-- Create index for efficient retry queries
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_retry 
ON public.scheduled_posts(status, scheduled_for, retry_count) 
WHERE status IN ('pending', 'failed');

-- Add comment for documentation
COMMENT ON COLUMN public.scheduled_posts.retry_count IS 'Number of failed publish attempts (max 3)';
COMMENT ON COLUMN public.post_logs.scheduled_post_id IS 'Links log entry to specific scheduled post attempt';