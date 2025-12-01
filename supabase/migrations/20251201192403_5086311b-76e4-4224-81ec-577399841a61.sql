-- Add AI-generated content fields to projects table
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS ideas jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hooks jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS script text;