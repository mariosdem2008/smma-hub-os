-- Add rejection_category to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS rejection_category TEXT;

-- Create index for filtering by rejection category
CREATE INDEX IF NOT EXISTS idx_projects_rejection_category ON public.projects(rejection_category) WHERE rejection_category IS NOT NULL;