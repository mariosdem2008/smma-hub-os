-- Add additional background color fields to agency_branding
ALTER TABLE public.agency_branding
ADD COLUMN IF NOT EXISTS header_bg_color text,
ADD COLUMN IF NOT EXISTS sidebar_bg_color text,
ADD COLUMN IF NOT EXISTS content_bg_color text,
ADD COLUMN IF NOT EXISTS card_bg_color text;