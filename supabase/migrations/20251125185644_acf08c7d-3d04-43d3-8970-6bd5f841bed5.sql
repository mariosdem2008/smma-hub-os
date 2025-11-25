-- Add title field to assets table for user-provided titles
ALTER TABLE public.assets
ADD COLUMN IF NOT EXISTS title text;

-- Add comment for clarity
COMMENT ON COLUMN public.assets.title IS 'User-provided title for the content (separate from filename)';