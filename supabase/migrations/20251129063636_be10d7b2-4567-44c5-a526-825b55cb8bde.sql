-- Add error_message column to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS error_message TEXT;