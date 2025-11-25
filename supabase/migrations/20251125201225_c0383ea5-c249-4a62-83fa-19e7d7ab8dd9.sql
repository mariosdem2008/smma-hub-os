-- Drop tasks table and related objects
DROP TABLE IF EXISTS public.tasks CASCADE;

-- Drop posts table and related objects if they still exist
DROP TABLE IF EXISTS public.posts CASCADE;
DROP TABLE IF EXISTS public.post_metrics CASCADE;