-- Remove invite_token column as it's no longer needed
-- The flow now is: store email invitation -> user signs up with that email -> match and grant access

ALTER TABLE public.client_portal_users 
DROP COLUMN IF EXISTS invite_token;