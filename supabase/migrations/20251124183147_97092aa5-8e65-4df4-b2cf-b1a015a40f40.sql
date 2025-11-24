-- Remove all branding columns except email identity and custom domain
ALTER TABLE public.agency_branding
DROP COLUMN IF EXISTS logo_url,
DROP COLUMN IF EXISTS favicon_url,
DROP COLUMN IF EXISTS primary_color,
DROP COLUMN IF EXISTS accent_color,
DROP COLUMN IF EXISTS header_bg_color,
DROP COLUMN IF EXISTS sidebar_bg_color,
DROP COLUMN IF EXISTS content_bg_color,
DROP COLUMN IF EXISTS card_bg_color,
DROP COLUMN IF EXISTS font_primary,
DROP COLUMN IF EXISTS font_secondary,
DROP COLUMN IF EXISTS layout_style,
DROP COLUMN IF EXISTS section_labels;