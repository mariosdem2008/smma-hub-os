-- Allow user_id to be nullable initially in client_portal_users
ALTER TABLE public.client_portal_users 
ALTER COLUMN user_id DROP NOT NULL;