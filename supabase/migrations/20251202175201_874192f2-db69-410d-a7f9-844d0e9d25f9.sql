-- Create table for client portal refresh tokens
CREATE TABLE IF NOT EXISTS public.client_refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL REFERENCES public.client_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_refresh_tokens_token_hash_key UNIQUE (token_hash)
);

-- Enable RLS (only service role will access this table via edge functions)
ALTER TABLE public.client_refresh_tokens ENABLE ROW LEVEL SECURITY;