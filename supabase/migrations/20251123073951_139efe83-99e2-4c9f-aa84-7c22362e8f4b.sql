-- Add new fields to agencies table for onboarding
ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS niche text,
ADD COLUMN IF NOT EXISTS brand_color text;